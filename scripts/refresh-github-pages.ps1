$ErrorActionPreference = 'Stop'

$projectDir = 'C:\Users\yanhan\Documents\Codex\2026-08-25\cek-penarikan-x20\withdrawal-fpd-dashboard'
$workspaceDir = 'C:\Users\yanhan\Documents\Codex\2026-08-25\cek-penarikan-x20'
$downloadDir = 'C:\Users\yanhan\Downloads'
$dataDir = Join-Path $projectDir 'data'
$withdrawalFile = Join-Path $dataDir 'withdrawal.csv'
$fpdFile = Join-Path $dataDir 'fpd.csv'
$finalHtml = Join-Path $workspaceDir '授信后提现与FPD监控_最终版.html'
$logFile = Join-Path $projectDir 'refresh-dashboard.log'
$withdrawalDs = 'xb904dccda30f4b37bdde470'
$fpdDs = 'xcdf56cdcf3204513a04e131'
$gitExe = 'C:\Users\yanhan\.cache\codex-runtimes\codex-primary-runtime\dependencies\native\git\cmd\git.exe'

function Write-Log([string]$message) {
    $line = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')  $message"
    Add-Content -LiteralPath $logFile -Value $line -Encoding utf8
    Write-Host $line
}

function Get-MaxDate([string]$path, [string]$column) {
    if (-not (Test-Path -LiteralPath $path)) { return $null }
    $rows = Import-Csv -LiteralPath $path
    if (-not $rows) { return $null }
    return ($rows | ForEach-Object { $_.$column } | Where-Object { $_ } | Sort-Object | Select-Object -Last 1)
}

function Assert-Export([string]$newPath, [string]$dateColumn, [string[]]$requiredColumns) {
    if (-not (Test-Path -LiteralPath $newPath)) { throw "导出文件不存在：$newPath" }
    $newRows = @(Import-Csv -LiteralPath $newPath)
    if ($newRows.Count -eq 0) { throw "导出结果为空：$newPath" }
    $columns = @($newRows[0].PSObject.Properties.Name)
    foreach ($requiredColumn in $requiredColumns) {
        if (-not ($columns -contains $requiredColumn)) {
            throw "缺少必需字段 $requiredColumn：$newPath"
        }
    }
    return $newRows.Count
}

try {
    Set-Location -LiteralPath $projectDir
    Write-Log '开始检查观远数据。'
    guancli auth status | Out-Null

    $oldWithdrawalMax = Get-MaxDate $withdrawalFile 'credit_pass_date'
    $oldFpdMax = Get-MaxDate $fpdFile 'loan_date'
    $tempWithdrawal = Join-Path $downloadDir ('export4-' + [guid]::NewGuid().ToString('N') + '.csv')
    $tempFpd = Join-Path $downloadDir ('export5-' + [guid]::NewGuid().ToString('N') + '.csv')

    guancli ds preview $withdrawalDs --limit 60000 -f csv | Set-Content -LiteralPath $tempWithdrawal -Encoding utf8
    guancli ds preview $fpdDs --limit 60000 -f csv | Set-Content -LiteralPath $tempFpd -Encoding utf8

    $withdrawalCount = Assert-Export $tempWithdrawal 'credit_pass_date' @('credit_pass_date','risk_level','product','platform','t0_withdraw_numerator','t7_withdraw_numerator')
    $fpdCount = Assert-Export $tempFpd 'loan_date' @('loan_date','risk_level','product','platform','loan_order_cnt','fpd0_numerator','fpd10_numerator')
    $newWithdrawalMax = Get-MaxDate $tempWithdrawal 'credit_pass_date'
    $newFpdMax = Get-MaxDate $tempFpd 'loan_date'

    & $gitExe diff --quiet -- data/withdrawal.csv data/fpd.csv src/data.json dist/index.html
    $hasUnpublishedChanges = ($LASTEXITCODE -ne 0)

    if (($newWithdrawalMax -le $oldWithdrawalMax) -and ($newFpdMax -le $oldFpdMax) -and (-not $hasUnpublishedChanges)) {
        Remove-Item -LiteralPath $tempWithdrawal, $tempFpd -Force
        Write-Log "数据日期未前进，保留线上版本。提现=$newWithdrawalMax，FPD=$newFpdMax。"
        exit 0
    }

    Move-Item -LiteralPath $tempWithdrawal -Destination $withdrawalFile -Force
    Move-Item -LiteralPath $tempFpd -Destination $fpdFile -Force

    node (Join-Path $projectDir 'scripts\build-dashboard-snapshot.mjs')
    npm run build
    Copy-Item -LiteralPath (Join-Path $projectDir 'dist\index.html') -Destination $finalHtml -Force

    # The Vite build clears dist; keep the existing Sites-only protected artifacts intact on main.
    & $gitExe restore --source=HEAD -- 'dist/.openai/hosting.json' 'dist/server/index.js'

    & $gitExe add .gitignore data/withdrawal.csv data/fpd.csv src/data.json dist/index.html scripts/build-dashboard-snapshot.mjs scripts/refresh-github-pages.ps1
    & $gitExe diff --cached --quiet
    if ($LASTEXITCODE -eq 0) {
        Write-Log '文件无变化，无需发布。'
        exit 0
    }
    & $gitExe commit -m "Refresh dashboard data through $newWithdrawalMax"
    & $gitExe push github main
    & $gitExe subtree split --prefix dist --branch gh-pages
    & $gitExe push github gh-pages --force

    Write-Log "更新成功。提现=$withdrawalCount 行/$newWithdrawalMax；FPD=$fpdCount 行/$newFpdMax。"
}
catch {
    Write-Log ("更新失败：" + $_.Exception.Message)
    exit 1
}
