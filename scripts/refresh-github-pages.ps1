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
$guancliCmd = 'C:\Users\yanhan\AppData\Roaming\npm\guancli.cmd'

function Write-Log([string]$message) {
    $line = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')  $message"
    Add-Content -LiteralPath $logFile -Value $line -Encoding utf8
    Write-Host $line
}

function Get-MaxDate([string]$path, [string]$column) {
    if (-not (Test-Path -LiteralPath $path)) { return $null }
    $rows = Import-Csv -LiteralPath $path -Encoding UTF8
    if (-not $rows) { return $null }
    return ($rows | ForEach-Object { $_.$column } | Where-Object { $_ } | Sort-Object | Select-Object -Last 1)
}

function Assert-Export([string]$newPath, [string]$dateColumn, [string[]]$requiredColumns) {
    if (-not (Test-Path -LiteralPath $newPath)) { throw "导出文件不存在：$newPath" }
    $newRows = @(Import-Csv -LiteralPath $newPath -Encoding UTF8)
    if ($newRows.Count -eq 0) { throw "导出结果为空：$newPath" }
    $columns = @($newRows[0].PSObject.Properties.Name)
    $expectedColumnCount = $columns.Count
    $invalidLineCount = @(Get-Content -LiteralPath $newPath -Encoding UTF8 | Select-Object -Skip 1 | Where-Object {
        ($_.Split(',').Count) -ne $expectedColumnCount
    }).Count
    if ($invalidLineCount -gt 0) {
        throw "CSV存在 $invalidLineCount 行字段错位，停止发布：$newPath"
    }
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
    if ($LASTEXITCODE -ne 0) { throw '观远登录状态检查失败。' }

    $oldWithdrawalMax = Get-MaxDate $withdrawalFile 'credit_pass_date'
    $oldFpdMax = Get-MaxDate $fpdFile 'loan_date'
    $tempWithdrawal = Join-Path $downloadDir ('export4-' + [guid]::NewGuid().ToString('N') + '.csv')
    $tempFpd = Join-Path $downloadDir ('export5-' + [guid]::NewGuid().ToString('N') + '.csv')

    $withdrawCommand = '""{0}" ds preview {1} --limit 60000 -f csv > "{2}""' -f $guancliCmd,$withdrawalDs,$tempWithdrawal
    & $env:ComSpec /d /s /c $withdrawCommand
    if ($LASTEXITCODE -ne 0) { throw '提现数据导出失败。' }
    $fpdCommand = '""{0}" ds preview {1} --limit 60000 -f csv > "{2}""' -f $guancliCmd,$fpdDs,$tempFpd
    & $env:ComSpec /d /s /c $fpdCommand
    if ($LASTEXITCODE -ne 0) { throw 'FPD数据导出失败。' }

    $withdrawalCount = Assert-Export $tempWithdrawal 'credit_pass_date' @('credit_pass_date','risk_level','product','platform','t0_withdraw_numerator','t7_withdraw_numerator')
    $fpdCount = Assert-Export $tempFpd 'loan_date' @('loan_date','risk_level','product','platform','loan_order_cnt','fpd0_numerator','fpd10_numerator')
    $newWithdrawalMax = Get-MaxDate $tempWithdrawal 'credit_pass_date'
    $newFpdMax = Get-MaxDate $tempFpd 'loan_date'

    & $gitExe diff --quiet -- data/withdrawal.csv data/fpd.csv src/data.json src/content/dashboard/DashboardContent.jsx src/content/dashboard/dashboard.css dist/index.html
    $hasUnpublishedChanges = ($LASTEXITCODE -ne 0)

    if (($oldWithdrawalMax -and $newWithdrawalMax -lt $oldWithdrawalMax) -or
        ($oldFpdMax -and $newFpdMax -lt $oldFpdMax)) {
        throw "业务日期发生倒退，停止发布。提现=$oldWithdrawalMax->$newWithdrawalMax；FPD=$oldFpdMax->$newFpdMax。"
    }

    $withdrawalChanged = (Get-FileHash -LiteralPath $tempWithdrawal -Algorithm SHA256).Hash -ne
                         (Get-FileHash -LiteralPath $withdrawalFile -Algorithm SHA256).Hash
    $fpdChanged = (Get-FileHash -LiteralPath $tempFpd -Algorithm SHA256).Hash -ne
                  (Get-FileHash -LiteralPath $fpdFile -Algorithm SHA256).Hash

    if ((-not $withdrawalChanged) -and (-not $fpdChanged) -and (-not $hasUnpublishedChanges)) {
        Remove-Item -LiteralPath $tempWithdrawal, $tempFpd -Force
        Write-Log "底表内容无变化，保留线上版本。提现=$newWithdrawalMax，FPD=$newFpdMax。"
        exit 0
    }

    Move-Item -LiteralPath $tempWithdrawal -Destination $withdrawalFile -Force
    Move-Item -LiteralPath $tempFpd -Destination $fpdFile -Force

    node (Join-Path $projectDir 'scripts\build-dashboard-snapshot.mjs')
    if ($LASTEXITCODE -ne 0) { throw '看板数据生成失败。' }
    npm run build
    if ($LASTEXITCODE -ne 0) { throw '看板构建失败。' }
    Copy-Item -LiteralPath (Join-Path $projectDir 'dist\index.html') -Destination $finalHtml -Force

    # The Vite build clears dist; keep the existing Sites-only protected artifacts intact on main.
    & $gitExe restore --source=HEAD -- 'dist/.openai/hosting.json' 'dist/server/index.js'
    if ($LASTEXITCODE -ne 0) { throw '构建后文件恢复失败。' }

    & $gitExe add .gitignore data/withdrawal.csv data/fpd.csv src/data.json src/content/dashboard/DashboardContent.jsx dist/index.html scripts/build-dashboard-snapshot.mjs scripts/refresh-github-pages.ps1
    & $gitExe diff --cached --quiet
    if ($LASTEXITCODE -eq 0) {
        Write-Log '文件无变化，无需发布。'
        exit 0
    }
    & $gitExe commit -m "Refresh dashboard data through $newWithdrawalMax"
    if ($LASTEXITCODE -ne 0) { throw 'Git提交失败。' }
    & $gitExe push github main
    if ($LASTEXITCODE -ne 0) { throw 'GitHub主分支推送失败。' }
    & $gitExe subtree split --prefix dist --branch gh-pages
    if ($LASTEXITCODE -ne 0) { throw 'GitHub Pages分支生成失败。' }
    & $gitExe push github gh-pages --force
    if ($LASTEXITCODE -ne 0) { throw 'GitHub Pages推送失败。' }

    Write-Log "更新成功。提现=$withdrawalCount 行/$newWithdrawalMax；FPD=$fpdCount 行/$newFpdMax。"
}
catch {
    Write-Log ("更新失败：" + $_.Exception.Message)
    exit 1
}
