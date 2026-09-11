import fs from 'node:fs';
const withdrawalInput='C:/Users/yanhan/Documents/Codex/2026-08-25/cek-penarikan-x20/withdrawal-fpd-dashboard/data/withdrawal.csv',fpdInput='C:/Users/yanhan/Documents/Codex/2026-08-25/cek-penarikan-x20/withdrawal-fpd-dashboard/data/fpd.csv';
const output=new URL('../withdrawal-fpd-snapshot.json',import.meta.url),appOutput=new URL('../src/data.json',import.meta.url);
function parseLine(line){const cells=[];let value='',quoted=false;for(let i=0;i<line.length;i+=1){const c=line[i];if(c==='"'){if(quoted&&line[i+1]==='"'){value+='"';i+=1;}else quoted=!quoted;}else if(c===','&&!quoted){cells.push(value);value='';}else value+=c;}cells.push(value);return cells;}
function readCsv(file){const [header,...lines]=fs.readFileSync(file,'utf8').trim().split(/\r?\n/),fields=parseLine(header);const numeric=new Set(fields.filter(f=>f.endsWith('_cnt')||f.endsWith('_numerator')||f.endsWith('_denominator')||f.endsWith('_sum')));return lines.filter(Boolean).map(line=>{const values=parseLine(line);return Object.fromEntries(fields.map((field,i)=>[field,numeric.has(field)?Number(values[i]||0):(values[i]??'')]))});}
function productGroup(code){if(['CL_01','CL_06'].includes(code))return'等本';if(code==='CL_07')return'小等本';if(['CL_03','CL_04','CL_05'].includes(code))return'灵活产品';if(code==='CL_08')return'营销产品';return'其他产品';}
const withdrawalRows=readCsv(withdrawalInput).map(row=>({...row,product:productGroup(row.product)})).sort((a,b)=>String(a.credit_pass_date).localeCompare(String(b.credit_pass_date)));
const fpdRows=readCsv(fpdInput).map(row=>({...row,
  loan_type:row.loan_type==='01_首笔放款'?'首借':row.loan_type==='02_非首笔放款'?'复借':row.loan_type,
  product:productGroup(row.product),
  credit_pass_date:row.loan_date
})).sort((a,b)=>String(a.loan_date).localeCompare(String(b.loan_date)));
const dates=[...withdrawalRows.map(r=>r.credit_pass_date),...fpdRows.map(r=>r.loan_date)].sort();
const products=[...new Set([...withdrawalRows,...fpdRows].map(r=>r.product).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'zh-CN',{numeric:true}));
const risks=[...new Set([...withdrawalRows,...fpdRows].map(r=>r.risk_level).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'zh-CN',{numeric:true}));
const filterRows=Array.from({length:Math.max(products.length,risks.length)},(_,i)=>({product:products[i]??'',risk_level:risks[i]??''}));
const snapshot={id:'credit-withdrawal-fpd-monitor-clear-defaults-v1',surface:'dashboard',title:'授信后提现与FPD监控',generatedAt:new Date().toISOString(),status:'reviewed',filters:[
  {id:'credit_pass_date',label:'日期范围',field:'credit_pass_date',mode:'through',defaultValue:`${dates[0]}..${dates.at(-1)}`},
  {id:'product',label:'产品',field:'product',multiple:true,defaultValue:[]},{id:'risk_level',label:'风险等级',field:'risk_level',multiple:true,defaultValue:[]},
  {id:'credit_type',label:'授信类型',field:'credit_type',multiple:true,defaultValue:[]},{id:'platform',label:'手机系统',field:'platform',multiple:true,defaultValue:[]},
  {id:'media',label:'媒体渠道',field:'media',multiple:true,defaultValue:[]},
  {id:'loan_type',label:'首复借',field:'loan_type',multiple:true,defaultValue:[],queryIds:['loan_fpd_monitor']}],queries:{
  filter_options:{rows:filterRows,source:{label:'筛选项升序辅助维度',metricDefinitions:[]}},
  withdrawal_monitor:{rows:withdrawalRows,source:{label:'withdrawal.csv · 授信后提现每日聚合',files:[withdrawalInput],metricDefinitions:[
    {label:'T0/T7提现申请率',definition:'窗口内首笔提现申请客户数 / 授信通过客户数；T7仅成熟客群进入分母。'},
    {label:'T0额度使用率',definition:'T0第一笔提现申请金额 / 对应授信额度。'},
    {label:'授信通过客户人均授信额度',definition:'授信通过额度合计 / 授信通过客户数。'},
    {label:'T0提现申请客户人均授信额度',definition:'T0提现申请客户对应授信额度合计 / T0提现申请客户数。'},
    {label:'各授信额度分桶T0提现申请率',definition:'各授信额度档位T0提现申请客户数 / 对应授信通过客户数。'},
    {label:'授信通过客户额度分桶结构',definition:'各授信额度档位授信通过客户数 / 全部授信通过客户数，每期合计100%。'},
    {label:'各风险等级人均授信额度',definition:'各风险等级授信通过额度合计 / 对应授信通过客户数。'},
    {label:'T0额度使用率分桶占比',definition:'T0提现申请客户按申请金额除以授信额度划分为100%以下、100%及以上，汇总占比合计100%。'}]}},
  loan_fpd_monitor:{rows:fpdRows,source:{label:'fpd.csv · 正式放款订单FPD每日聚合',files:[fpdInput],metricDefinitions:[
    {label:'FPD0和FPD10订单逾期率',definition:'逾期订单数除以已到相应观察期的全部正式放款订单数。'},
    {label:'FPD0和FPD10金额逾期率',definition:'逾期订单loan_amt除以已到相应观察期订单loan_amt。'},
    {label:'放款额度使用率',definition:'正式放款loan_amt加总除以对应授信额度加总。'}]}}
}};
fs.writeFileSync(output,JSON.stringify(snapshot,null,2));fs.writeFileSync(appOutput,JSON.stringify(snapshot,null,2));
console.log(JSON.stringify({withdrawalRows:withdrawalRows.length,fpdRows:fpdRows.length,start:dates[0],end:dates.at(-1)},null,2));
