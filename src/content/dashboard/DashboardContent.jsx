import React,{useEffect,useMemo,useRef,useState} from "react";
import {EvidenceChart as BaseEvidenceChart,Filters as BaseFilters,MetricCard,SegmentedControl,SectionHeader,useDataApp,useDashboardTabs} from "../../data-app-public.jsx";
import "./dashboard.css";
import {fixedDimensionOrder} from "./dimension-order.js";
const tabs=[{id:"withdrawal",label:"01_T0/T7提现率"},{id:"fpd",label:"02_提现订单及FPD"}],baseFilterIds=["credit_pass_date","original_product","product","app_version","credit_type","risk_level","platform","media"];
const riskOrder=["RG0","RG1","RG2","RG3","RG4","RG5","RG6","RG7"],creditLimitOrder=["200万及以上","180万","150万","120万","100万","80万","60万","50万","40万","30万"];
const platformOrder=["Android","iOS","未知"],mediaOrder=["ASA","Facebook","Google","Organic","Tiktok","其他","空值"],originalProductOrder=["CL_01","CL_03","CL_04","CL_05","CL_06","CL_07","CL_08"],productOrder=["等本","小等本","灵活产品","营销产品","其他产品"],loanTypeOrder=["首借","复借"],utilizationOrder=["100%以下","100%及以上","额度缺失"];
const stablePalette=["#1296db","#e87500","#61c998","#979500","#8b7cf6","#e35d8f","#4f78d1","#42a383","#d7a441","#bd7fa3","#6ea6c8","#527f73","#ef6a5b","#7b8da8","#9c6ade","#2f9c95","#c47a38","#5e8c45","#b85c76","#6f6f9f","#58a6a6","#a66c3f","#7c8f3b","#8d6b94"];
const namedColors={
  "T0提现申请率":"#00a0bf","T7提现申请率":"#d78700","T0 (%)":"#00a0bf","T7 (%)":"#d78700","t0Rate (%)":"#00a0bf","t7Rate (%)":"#d78700",
  FPD0:"#00a0bf",FPD10:"#d78700","fpd0Rate (%)":"#00a0bf","fpd10Rate (%)":"#d78700","fpd0AmountRate (%)":"#00a0bf","fpd10AmountRate (%)":"#d78700",
  Android:"#1296db",iOS:"#e35d8f",未知:"#9aa3ad",UNKNOWN:"#9aa3ad",
  ASA:"#f2afa3",Facebook:"#1296db",Google:"#e87500",Organic:"#61c998",Tiktok:"#979500",其他:"#9ecbe5",空值:"#e6c8dc",
  RG0:"#7185ff",RG1:"#ef6955",RG2:"#00a88f",RG3:"#e45d87",RG4:"#00a0bf",RG5:"#cf57a5",RG6:"#d7a441",RG7:"#7b8da8",
  CL_01:"#1296db",CL_03:"#e87500",CL_04:"#61c998",CL_05:"#e35d8f",CL_06:"#8b7cf6",CL_07:"#979500",CL_08:"#6ea6c8",
  等本:"#1296db",小等本:"#e87500",灵活产品:"#61c998",营销产品:"#e35d8f",其他产品:"#9aa3ad",
  首借:"#1296db",复借:"#e87500",
  "200万及以上":"#527f73","180万":"#6ea6c8","150万":"#8f8f8f","120万":"#fa423e","100万":"#bd7fa3","80万":"#d7a441","60万":"#8390ad","50万":"#9ab7c7","40万":"#75b39f","30万":"#42a383","其他额度":"#9aa3ad",
  "100%以下":"#d78700","100%及以上":"#00a0bf",额度缺失:"#9aa3ad","1.2.9":"#d32f2f"
};
function stableColor(value){const text=String(value??"");let hash=2166136261;for(let i=0;i<text.length;i++){hash^=text.charCodeAt(i);hash=Math.imul(hash,16777619)}return stablePalette[(hash>>>0)%stablePalette.length]}
const sum=(a,f)=>a.reduce((n,r)=>n+Number(r[f]||0),0),ratio=(n,d)=>d?n/d:null,pct=v=>v==null?"—":`${(v*100).toFixed(1)}%`,num=v=>v==null?"—":Math.round(v).toLocaleString("en-US"),wan=v=>v==null?"—":`${(Number(v)/10000).toFixed(1)}w`;
const sd=v=>/^\d{4}-\d{2}-\d{2}$/.test(v??"")?`${v.slice(5,7)}/${v.slice(8,10)}`:v,cd=v=>`${sd(v)}\u2060`;
function week(d){const x=new Date(`${d}T00:00:00Z`);x.setUTCDate(x.getUTCDate()-((x.getUTCDay()+2)%7));return x.toISOString().slice(0,10)}
function groups(rows,grain){const m=new Map();rows.forEach(r=>{const p=grain==="week"?week(r.credit_pass_date):r.credit_pass_date,a=m.get(p)??[];a.push(r);m.set(p,a)});return[...m].sort(([a],[b])=>a.localeCompare(b))}
function ws(a){const hasCreditLimit=a.some(r=>Object.hasOwn(r,"credit_pass_limit_amt_sum")),x={credit_pass_customer_cnt:sum(a,"credit_pass_customer_cnt"),credit_pass_limit_amt_sum:hasCreditLimit?sum(a,"credit_pass_limit_amt_sum"):null,t0_withdraw_numerator:sum(a,"t0_withdraw_numerator"),t0_withdraw_denominator:sum(a,"t0_withdraw_denominator"),t7_withdraw_numerator:sum(a,"t7_withdraw_numerator"),t7_withdraw_denominator:sum(a,"t7_withdraw_denominator"),un:sum(a,"t0_withdraw_utilization_numerator"),ud:sum(a,"t0_withdraw_utilization_denominator"),t0LoanAmt:sum(a,"t0_loan_amt_sum"),t0LoanCustomers:sum(a,"t0_loan_customer_cnt")},full=x.t7_withdraw_denominator===x.credit_pass_customer_cnt;return{...x,t7_withdraw_denominator:full?x.t7_withdraw_denominator:0,t0:ratio(x.t0_withdraw_numerator,x.t0_withdraw_denominator),t7:full?ratio(x.t7_withdraw_numerator,x.t7_withdraw_denominator):null,util:ratio(x.un,x.ud),avgCreditLimit:hasCreditLimit?ratio(x.credit_pass_limit_amt_sum,x.credit_pass_customer_cnt):null,avgT0CreditLimit:ratio(x.ud,x.t0_withdraw_numerator),avgT0LoanAmount:ratio(x.t0LoanAmt,x.t0LoanCustomers)}}
function fs(a){const names=["loan_order_cnt","loan_customer_cnt","loan_amt_sum","credit_limit_sum","fpd0_numerator","fpd0_denominator","fpd0_amt_numerator","fpd0_amt_denominator","fpd10_numerator","fpd10_denominator","fpd10_amt_numerator","fpd10_amt_denominator"],x=Object.fromEntries(names.map(f=>[f,sum(a,f)]));return{...x,fpd0Rate:ratio(x.fpd0_numerator,x.fpd0_denominator),fpd10Rate:ratio(x.fpd10_numerator,x.fpd10_denominator),fpd0AmountRate:ratio(x.fpd0_amt_numerator,x.fpd0_amt_denominator),fpd10AmountRate:ratio(x.fpd10_amt_numerator,x.fpd10_amt_denominator),util:ratio(x.loan_amt_sum,x.credit_limit_sum)}}
const periods=(r,g,s)=>groups(r,g).map(([p,a])=>({period:p,label:cd(p),...s(a)}));
const rateAliases={t0:"t0Rate",t7:"t7Rate",util:"utilizationRate",rate:"segmentRate",fa0:"fpd0AmountRate",fa3:"fpd3AmountRate",share:"segmentShare"};
function Filters(props){
  const {queries,values,filters}=props;
  const fpd=filters.some(filter=>filter.id==="loan_type");
  const range=values.credit_pass_date??filters.find(filter=>filter.id==="credit_pass_date")?.defaultValue;
  const productQueries=useMemo(()=>{
    const [start,end]=String(range??"all").split("..");
    const source=queries[fpd?"loan_fpd_monitor":"withdrawal_monitor"]?.rows??[];
    const options=Object.fromEntries(["original_product","risk_level","app_version"].map(field=>[field,new Set()]));
    for(const row of source){
      const date=fpd?row.loan_date:row.credit_pass_date;
      const inRange=start==="all"||!range||(end?date>=start&&date<=end:date<=start);
      if(inRange&&Number(fpd?row.loan_order_cnt:row.credit_pass_customer_cnt)>0){
        for(const field of Object.keys(options))if(row[field])options[field].add(row[field]);
      }
    }
    return {...queries,...Object.fromEntries(Object.entries(options).map(([field,entries])=>[
      `date_options_${field}`,{rows:[...entries].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true})).map(value=>({[field]:value}))}
    ]))};
  },[queries,range,fpd]);
  const scopedFilters=useMemo(()=>filters.map(filter=>["original_product","risk_level","app_version"].includes(filter.id)?{...filter,queryIds:[`date_options_${filter.id}`]}:filter),[filters]);
  return <BaseFilters {...props} queries={productQueries} filters={scopedFilters}/>;
}
function EvidenceChart({spec,rows,wrapperClassName="",...props}){
  const alias=field=>rateAliases[field]??field;
  const displayField=field=>/(?:Rate|Share)$/.test(alias(field))?`${alias(field)} (%)`:alias(field);
  const rateFields=[spec?.y,...(spec?.fields??[])].filter(Boolean);
  const mappedRows=rows.map(row=>({...row,...Object.fromEntries(rateFields.map(field=>{
    const target=displayField(field),value=row[field];
    return [target,target.endsWith(" (%)")&&value!=null?Number(value)*100:value];
  }))}));
  const metricLabels={t0:"T0提现申请率",t7:"T7提现申请率",util:"额度使用率",avgCreditLimit:"人均授信额度",avgT0CreditLimit:"T0提现申请客户人均授信额度",avgT0LoanAmount:"T0客户人均放款金额",loan_order_cnt:"放款订单数",count:"客户人数",share:"客户占比",fpd0AmountRate:"FPD0金额逾期率",fpd10AmountRate:"FPD10金额逾期率",fpd0Rate:"FPD0订单逾期率",fpd10Rate:"FPD10订单逾期率"};
  const dimensionOrder=spec.series?fixedDimensionOrder(rows.map(row=>row[spec.series]),spec.tooltipOrder):[...new Set(rateFields.map(displayField))];
  const legendLabels={...Object.fromEntries(rateFields.map(field=>[displayField(field),metricLabels[field]??spec.yLabel??"指标值"])),...Object.fromEntries(Object.entries(spec?.legend?.labels??{}).map(([field,label])=>[displayField(field),metricLabels[field]??label])),...(spec.series?Object.fromEntries(dimensionOrder.map(value=>[value,value])):{})};
  const uniquePeriods=new Set(mappedRows.map(row=>row[spec?.x])).size;
  const seriesCount=spec?.series?new Set(mappedRows.map(row=>row[spec.series])).size:(spec?.fields?.length??1);
  const showValues=spec?.showValues??(spec?.type==="line"&&seriesCount<=8);
  const isRateChart=rateFields.some(field=>displayField(field).endsWith(" (%)"));
  const colorKeys=[...dimensionOrder,...rateFields.map(displayField)];
  const fixedColors=Object.fromEntries(colorKeys.map(value=>[value,namedColors[value]??stableColor(value)]));
  const mappedSpec={...spec,tooltipSort:"dimension",tooltipOrder:dimensionOrder,colors:{...fixedColors,...spec?.colors},y:displayField(spec?.y),...(spec?.fields?{fields:spec.fields.map(displayField)}:{}),valueDecimals:1,valueSuffix:isRateChart?"%":spec?.valueSuffix,showValues,legend:{...spec.legend,labels:legendLabels}};
  const frameRef=useRef(null);
  useEffect(()=>{
    if(!isRateChart||!frameRef.current)return;
    const fix=()=>{
      frameRef.current.querySelectorAll(".recharts-cartesian-axis-tick-value,.chart-tooltip b").forEach(node=>{
      const value=node.textContent?.trim(),match=value?.match(/^(-?\d+(?:\.\d+)?)%$/);
      if(match){const formatted=`${Number(match[1]).toFixed(1)}%`;if(value!==formatted)node.textContent=formatted}
      });
      frameRef.current.querySelectorAll(".recharts-label-list text").forEach(node=>{
        const current=node.textContent?.trim();
        if(current&&/^-?\d+(?:\.\d+)?$/.test(current))node.textContent=`${Number(current).toFixed(1)}%`;
      });
      if(frameRef.current.classList.contains("withdraw-rate-trend")){
        frameRef.current.querySelectorAll(".recharts-label-list").forEach((group,index)=>group.querySelectorAll("text[data-ay]").forEach(label=>{
          const desired=String(Number(label.dataset.ay)+(index===0?22:-12));
          if(label.getAttribute("y")!==desired)label.setAttribute("y",desired);
          label.style.transform="none";
        }));
      }
    };
    fix();
    let pending=0,timer=0;
    const schedule=()=>{if(!pending)pending=requestAnimationFrame(()=>{pending=0;fix();clearTimeout(timer);timer=setTimeout(fix,80)})};
    const observer=new MutationObserver(schedule);
    observer.observe(frameRef.current,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:["y"]});
    const resizeObserver=new ResizeObserver(schedule);resizeObserver.observe(frameRef.current);
    schedule();
    return()=>{observer.disconnect();resizeObserver.disconnect();cancelAnimationFrame(pending);clearTimeout(timer)};
  },[isRateChart,mappedRows]);
  return <div ref={frameRef} className={`${isRateChart?"rate-chart-frame":"chart-frame"} ${wrapperClassName}`.trim()}><BaseEvidenceChart spec={mappedSpec} rows={mappedRows} {...props}/></div>;
}
function M({id,q,title,value,note,rows}){return <MetricCard variant="card" id={id} queryId={q} title={title} value={value} description={note} sourceRows={rows}/>}
function RateBreakdownTooltip({active,label,payload=[],sourceRows=[],overall=false,order=[]}){
  if(!active||!payload.length)return null;
  const rawItems=payload.filter(item=>item.value!=null&&item.dataKey!=="baseline");
  const itemKey=item=>{const row=item?.payload??{};return String(row.risk??row.segment??item.name??item.dataKey??"").replace(/^\d+_/i,"")};
  const fixedOrder=order?.length?order:fixedDimensionOrder(rawItems.map(itemKey));
  const ranks=new Map(fixedOrder.map((value,index)=>[String(value),index]));
  const items=[...rawItems].sort((a,b)=>(ranks.get(itemKey(a))??999)-(ranks.get(itemKey(b))??999)||itemKey(a).localeCompare(itemKey(b),undefined,{numeric:true}));
  if(!items.length)return null;
  const normalizedLabel=String(label??"").replace(/\u2060/g,"");
  return <div className="chart-tooltip dashboard-rate-tooltip">
    {label!=null&&<strong>{String(label).replace(/\u2060/g,"")}</strong>}
    {items.map((item,index)=>{
      const row=item.payload??{},key=String(item.dataKey??item.name??"");
      const metric=overall&&({"T0 (%)":{name:"T0提现申请率",numerator:"t0_withdraw_numerator",denominator:"t0_withdraw_denominator"},"T7 (%)":{name:"T7提现申请率",numerator:"t7_withdraw_numerator",denominator:"t7_withdraw_denominator"},"fpd0AmountRate (%)":{name:"FPD0金额逾期率",numerator:"fpd0_amt_numerator",denominator:"fpd0_amt_denominator"},"fpd10AmountRate (%)":{name:"FPD10金额逾期率"}}[key]??{"T0提现申请率":{name:"T0提现申请率",numerator:"t0_withdraw_numerator",denominator:"t0_withdraw_denominator"},"T7提现申请率":{name:"T7提现申请率",numerator:"t7_withdraw_numerator",denominator:"t7_withdraw_denominator"},"FPD0金额逾期率":{name:"FPD0金额逾期率",numerator:"fpd0_amt_numerator",denominator:"fpd0_amt_denominator"},"FPD10金额逾期率":{name:"FPD10金额逾期率"}}[String(item.name??"")]);
      const name=metric?.name??String(row.risk??row.segment??item.name??item.dataKey).replace(/^\d+_/i,"");
      const seriesNames=new Set([name,item.name,item.dataKey].map(value=>String(value??"").replace(/^\d+_/i,"")));
      const source=sourceRows.find(candidate=>String(candidate.label??"").replace(/\u2060/g,"")===normalizedLabel&&(metric||seriesNames.has(String(candidate.risk??candidate.segment).replace(/^\d+_/i,""))));
      const numerator=metric?(row[metric.numerator]??source?.[metric.numerator]):row.numerator??source?.numerator,denominator=metric?(row[metric.denominator]??source?.[metric.denominator]):row.den??source?.den;
      return <span key={`${name}-${index}`}>
        <i style={{color:item.color??item.payload?.fill??"var(--chart-1)",background:item.color??item.payload?.fill??"var(--chart-1)"}}/>
        <span className="dashboard-rate-tooltip-label">{name}</span>
        <b>{`${Number(item.value).toFixed(1)}%`}{numerator!=null&&denominator!=null&&<small>{metric?.numerator==="fpd0_amt_numerator"?`${wan(numerator)} / ${wan(denominator)}`:`${num(numerator)}/${num(denominator)}`}</small>}</b>
      </span>;
    })}
  </div>;
}
function CompositionTooltip({active,label,payload=[],order=[],sourceRows=[]}){
  if(!active||!payload.length)return null;
  const rawItems=payload.filter(item=>item.value!=null&&item.dataKey!=="baseline");
  const itemKey=item=>String(item?.payload?.segment??item?.name??item?.dataKey??"").replace(/^\d+_/i,"");
  const fixedOrder=order?.length?order:fixedDimensionOrder(rawItems.map(itemKey));
  const ranks=new Map(fixedOrder.map((value,index)=>[String(value),index]));
  const items=[...rawItems].sort((a,b)=>(ranks.get(itemKey(a))??999)-(ranks.get(itemKey(b))??999)||itemKey(a).localeCompare(itemKey(b),undefined,{numeric:true}));
  if(!items.length)return null;
  const normalizedLabel=String(label??"").replace(/\u2060/g,"");
  return <div className="chart-tooltip dashboard-rate-tooltip">
    {label!=null&&<strong>{String(label).replace(/\u2060/g,"")}</strong>}
    {items.map((item,index)=>{
      const row=item.payload??{},name=itemKey(item),detail=row.__compositionDetails?.[name],source=sourceRows.find(candidate=>String(candidate.label??"").replace(/\u2060/g,"")===normalizedLabel&&String(candidate.segment??"").replace(/^\d+_/i,"")===name),count=row.count??detail?.count??source?.count,total=detail?.total??row.total??source?.total;
      return <span key={`${name}-${index}`}>
        <i style={{color:item.color??item.payload?.fill??"var(--chart-1)",background:item.color??item.payload?.fill??"var(--chart-1)"}}/>
        <span className="dashboard-rate-tooltip-label">{name}</span>
        <b>{`${Number(item.value).toFixed(1)}%`}<small>{num(count)} / {num(total)}</small></b>
      </span>;
    })}
  </div>;
}
function TrendDimensionSelector({value,onChange,options}){return <div className="trend-dimension-selector" role="group" aria-label="趋势拆分维度">{options.map(option=><button key={option.value} type="button" className={value===option.value?"is-active":""} aria-pressed={value===option.value} onClick={()=>onChange(option.value)}>{option.label}</button>)}</div>}
function productGroup(code){if(productOrder.includes(code))return code;if(["CL_01","CL_06"].includes(code))return"等本";if(code==="CL_07")return"小等本";if(["CL_03","CL_04","CL_05"].includes(code))return"灵活产品";if(code==="CL_08")return"营销产品";return"其他产品"}
function dimensionValue(row,dim){return row[dim]}
function creditPassCompositionWide(rows,grain,dim,order=[]){return groups(rows,grain).map(([d,a])=>{
  const total=sum(a,"credit_pass_customer_cnt"),values=[...new Set(a.map(r=>dimensionValue(r,dim)).filter(v=>v!=null&&String(v).trim()!==""))].map(value=>String(value).replace(/^\d+_/i,""));
  const ranks=new Map(order.map((value,index)=>[String(value),index])),ordered=[...values].sort((left,right)=>(ranks.get(left)??999)-(ranks.get(right)??999)||left.localeCompare(right,undefined,{numeric:true}));
  const details=Object.fromEntries(ordered.map(value=>{const count=sum(a.filter(r=>String(dimensionValue(r,dim)).replace(/^\d+_/i,"")===value),"credit_pass_customer_cnt");return[value,{count,total}]}));
  return{label:cd(d),total,__compositionDetails:details,...Object.fromEntries(ordered.map(value=>[value,total?((details[value].count/total)*100):0]))};
}).filter(row=>Object.keys(row.__compositionDetails).length>0)}
const dimensionLabels={platform:"平台",media:"媒体",original_product:"原始产品",product:"产品",app_version:"App版本",risk_level:"RG",credit_limit_bucket:"授信额度桶",credit_type:"授信类型"};
const attributionDimensions=["platform","media","original_product","product","risk_level","credit_limit_bucket","credit_type","app_version"];
const cleanDimensionValue=value=>String(value??"空值").replace(/^\d+_/i,"");
function analyzeT0Dimension(previousRows,latestRows,dimension,previousTotal,latestTotal){
  const values=[...new Set([...previousRows,...latestRows].map(row=>row[dimension]).filter(value=>value!=null&&String(value).trim()!==""))];
  const categories=values.map(rawValue=>{
    const previous=ws(previousRows.filter(row=>row[dimension]===rawValue)),latest=ws(latestRows.filter(row=>row[dimension]===rawValue));
    const previousRate=previous.t0??0,latestRate=latest.t0??0,previousShare=previousTotal?previous.t0_withdraw_denominator/previousTotal:0,latestShare=latestTotal?latest.t0_withdraw_denominator/latestTotal:0,averageShare=(previousShare+latestShare)/2;
    const mix=(latestShare-previousShare)*((previousRate+latestRate)/2),within=averageShare*(latestRate-previousRate);
    return{rawValue,label:cleanDimensionValue(rawValue),previousRate,latestRate,previousShare,latestShare,rateChange:latestRate-previousRate,mix,within,averageShare,previousDenominator:previous.t0_withdraw_denominator,latestDenominator:latest.t0_withdraw_denominator,score:Math.abs(latestRate-previousRate)*Math.sqrt(averageShare)};
  });
  return{dimension,categories,mix:categories.reduce((total,item)=>total+item.mix,0),within:categories.reduce((total,item)=>total+item.within,0),dominantShare:Math.max(0,...categories.map(item=>item.averageShare))};
}
function dailyT0Attribution(rows){
  const dates=[...new Set(rows.map(row=>row.credit_pass_date).filter(Boolean))].sort(),latestDate=dates.at(-1),previousDate=dates.at(-2);
  if(!latestDate||!previousDate)return null;
  const previousRows=rows.filter(row=>row.credit_pass_date===previousDate),latestRows=rows.filter(row=>row.credit_pass_date===latestDate),previous=ws(previousRows),latest=ws(latestRows);
  if(!previous.t0_withdraw_denominator||!latest.t0_withdraw_denominator)return null;
  const analyses=attributionDimensions.map(dimension=>analyzeT0Dimension(previousRows,latestRows,dimension,previous.t0_withdraw_denominator,latest.t0_withdraw_denominator));
  const useful=analyses.filter(item=>item.categories.length>1&&item.dominantShare<.95),structure=[...useful].sort((a,b)=>Math.abs(b.mix)-Math.abs(a.mix))[0];
  const candidates=useful.flatMap(analysis=>analysis.categories.filter(item=>item.averageShare>=.05&&item.previousDenominator+item.latestDenominator>=30).map(item=>({...item,dimension:analysis.dimension})));
  const primary=[...candidates].sort((a,b)=>b.score-a.score||Math.abs(b.within)-Math.abs(a.within))[0];
  let drill=null;
  if(primary){
    const priorSubset=previousRows.filter(row=>row[primary.dimension]===primary.rawValue),latestSubset=latestRows.filter(row=>row[primary.dimension]===primary.rawValue),priorSummary=ws(priorSubset),latestSummary=ws(latestSubset);
    const drillDimensions=["media","original_product","product","risk_level","credit_limit_bucket"].filter(dimension=>dimension!==primary.dimension);
    const drillCandidates=drillDimensions.flatMap(dimension=>{const analysis=analyzeT0Dimension(priorSubset,latestSubset,dimension,priorSummary.t0_withdraw_denominator,latestSummary.t0_withdraw_denominator);return analysis.categories.length>1&&analysis.dominantShare<.95?analysis.categories.filter(item=>item.averageShare>=.1&&item.previousDenominator+item.latestDenominator>=12).map(item=>({...item,dimension})):[]});
    drill=[...drillCandidates].sort((a,b)=>b.score-a.score||Math.abs(b.within)-Math.abs(a.within))[0]??null;
  }
  return{latestDate,previousDate,previous,latest,change:(latest.t0??0)-(previous.t0??0),structure,primary,drill};
}
const pp=value=>`${value>=0?"+":""}${(value*100).toFixed(1)}pp`;
function DailyAttribution({rows}){
  const result=useMemo(()=>dailyT0Attribution(rows),[rows]);
  if(!result)return null;
  const {latestDate,previousDate,previous,latest,change,structure,primary,drill}=result,structureLead=structure?.categories.filter(item=>!structure.mix||Math.sign(item.mix)===Math.sign(structure.mix)).sort((a,b)=>Math.abs(b.mix)-Math.abs(a.mix))[0],direction=change<0?"下降":"上升";
  return <section className="daily-attribution" aria-label="每日T0提现率波动归因">
    <div className="daily-attribution-head"><div><span>每日波动归因</span><strong>{sd(latestDate)} T0提现申请率 {pct(latest.t0)}</strong></div><b className={change<0?"is-negative":"is-positive"}>较{sd(previousDate)} {direction} {Math.abs(change*100).toFixed(1)}个百分点</b></div>
    <div className="daily-attribution-grid">
      <article><span>整体变化</span><strong>{num(previous.t0_withdraw_numerator)}/{num(previous.t0_withdraw_denominator)} → {num(latest.t0_withdraw_numerator)}/{num(latest.t0_withdraw_denominator)}</strong><p>申请人数 {num(previous.t0_withdraw_numerator)} → {num(latest.t0_withdraw_numerator)}（{latest.t0_withdraw_numerator-previous.t0_withdraw_numerator>=0?"+":""}{num(latest.t0_withdraw_numerator-previous.t0_withdraw_numerator)}），授信人数 {num(previous.t0_withdraw_denominator)} → {num(latest.t0_withdraw_denominator)}</p></article>
      <article><span>结构影响</span><strong>{structure?`${dimensionLabels[structure.dimension]??structure.dimension} ${pp(structure.mix)}`:"结构基本稳定"}</strong><p>{structureLead?`${structureLead.label}占比 ${(structureLead.previousShare*100).toFixed(1)}% → ${(structureLead.latestShare*100).toFixed(1)}%，结构贡献 ${pp(structureLead.mix)}`:"当前筛选下无可比结构"}</p></article>
      <article className="daily-attribution-primary"><span>主要异常定位</span><strong>{primary?`${dimensionLabels[primary.dimension]??primary.dimension} · ${primary.label}`:"暂无显著异常"}</strong><p>{primary?`${pct(primary.previousRate)} → ${pct(primary.latestRate)}（${pp(primary.rateChange)}），当日覆盖 ${(primary.latestShare*100).toFixed(1)}%，自身贡献 ${pp(primary.within)}`:"各维度波动均未达到样本门槛"}</p>{drill&&<small>继续下钻：{dimensionLabels[drill.dimension]??drill.dimension} · {drill.label}，{pct(drill.previousRate)} → {pct(drill.latestRate)}</small>}</article>
    </div>
    <p className="daily-attribution-note">归因同时评估结构变化、维度自身转化、覆盖率和样本量；各维度为同一批客户的不同切面，不跨维度累加。</p>
  </section>;
}
function segmentedTrend(rows,grain,dim,summarize,metric){return groups(rows,grain).flatMap(([d,a])=>[...new Set(a.map(r=>dimensionValue(r,dim)).filter(v=>v!=null&&String(v).trim()!==""))].map(value=>{const x=summarize(a.filter(r=>dimensionValue(r,dim)===value)),t0=metric==="t0";return{label:cd(d),segment:String(value).replace(/^\d+_/,""),rate:x[metric],numerator:t0?x.t0_withdraw_numerator:x.fpd0_numerator,den:t0?x.t0_withdraw_denominator:x.fpd0_denominator}}).filter(x=>x.rate!=null&&x.den>0))}
function segmentedMetric(rows,grain,dim,summarize,metric,valueField="rate"){return groups(rows,grain).flatMap(([d,a])=>[...new Set(a.map(r=>dimensionValue(r,dim)).filter(v=>v!=null&&String(v).trim()!==""))].map(value=>{const metricValue=summarize(a.filter(r=>dimensionValue(r,dim)===value))[metric];return{label:cd(d),segment:String(value).replace(/^\d+_/,""),[valueField]:metricValue}}).filter(x=>x[valueField]!=null))}
function riskShares(rows,grain,field,days=30){const last=[...new Set(rows.map(r=>r.credit_pass_date))].sort().at(-1),d=new Date(`${last}T00:00:00Z`);d.setUTCDate(d.getUTCDate()-days+1);const recent=rows.filter(r=>r.credit_pass_date>=d.toISOString().slice(0,10)),risks=[...new Set(recent.map(r=>r.risk_level))].sort();return{risks,rows:groups(recent,grain).flatMap(([p,a])=>{const total=sum(a,field);return risks.map(risk=>({label:cd(p),risk,share:ratio(sum(a.filter(r=>r.risk_level===risk),field),total)??0}))})}}
function riskCounts(rows,grain,field){const risks=[...new Set(rows.map(r=>r.risk_level))].sort();return{risks,rows:groups(rows,grain).flatMap(([p,a])=>risks.map(risk=>({label:cd(p),risk,count:sum(a.filter(r=>r.risk_level===risk),field)})).filter(r=>r.count>0))}}
function versionDistribution(rows,grain){const versions=[...new Set(rows.map(r=>r.app_version||"UNKNOWN"))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));return{versions,shareRows:groups(rows,grain).flatMap(([p,a])=>{const total=sum(a,"credit_pass_customer_cnt");return versions.map(version=>({label:cd(p),version,share:ratio(sum(a.filter(r=>(r.app_version||"UNKNOWN")===version),"credit_pass_customer_cnt"),total)??0}))}),countRows:groups(rows,grain).flatMap(([p,a])=>versions.map(version=>({label:cd(p),version,count:sum(a.filter(r=>(r.app_version||"UNKNOWN")===version),"credit_pass_customer_cnt")})).filter(r=>r.count>0))}}
export function DashboardContent(){const{snapshot,queries,filters,setFilter,reviewedRows,chartProps}=useDataApp(),{activeTabId}=useDashboardTabs(tabs),tab=activeTabId==="fpd"?"fpd":"withdrawal",[grain,setGrain]=useState("day"),q=tab==="fpd"?"loan_fpd_monitor":"withdrawal_monitor",filterIds=tab==="fpd"?[...baseFilterIds,"loan_type"]:baseFilterIds,fields=tab==="fpd"?["credit_pass_date","loan_date","loan_type","credit_type","original_product","product","app_version","risk_level","platform","media","loan_utilization_bucket"]:["credit_pass_date","credit_type","original_product","product","app_version","risk_level","platform","media","credit_limit_bucket","t0_utilization_bucket"],rows=reviewedRows(q,fields);return <><Filters sticky clearLabel="清除筛选" filters={snapshot.filters.filter(f=>filterIds.includes(f.id))} queries={queries} values={filters} onChange={setFilter} trailingControls={<SegmentedControl label="统计粒度" size="compact" value={grain} onChange={setGrain} options={[{value:"day",label:"按日"},{value:"week",label:"按周"}]}/>} /><header className="monitor-hero"><h1>{tab==="fpd"?"提现订单及FPD":"授信后提现转化"}</h1><p>{tab==="fpd"?"FPD采用官方宽表口径；额度使用率采用实际放款本金。":"T7分母仅包含已满7×24小时的授信通过客户。"}</p>{tab==="withdrawal"&&rows.length>0&&<DailyAttribution rows={rows}/>}</header>{rows.length?(tab==="fpd"?<Fpd2 rows={rows} grain={grain} cp={chartProps}/>:<Withdrawal rows={rows} grain={grain} cp={chartProps}/>):<p className="empty-state">当前筛选范围没有数据。</p>}</>}
function Withdrawal({rows,grain,cp}){
  const [trendDimension,setTrendDimension]=useState("overall"),[utilDimension,setUtilDimension]=useState("overall"),[avgCreditDimension,setAvgCreditDimension]=useState("overall"),[avgLoanDimension,setAvgLoanDimension]=useState("overall");
  const q="withdrawal_monitor",p=periods(rows,grain,ws),daily=periods(rows,"day",ws),latest=daily.at(-1),mature=daily.filter(x=>x.t7_withdraw_denominator>0).at(-1);
  const trendOptions=[{value:"overall",label:"整体"},{value:"platform",label:"平台"},{value:"media",label:"媒体"},{value:"original_product",label:"原始产品"},{value:"product",label:"产品"},{value:"app_version",label:"App版本"},{value:"risk_level",label:"RG"},{value:"credit_limit_bucket",label:"授信额度桶"}];
  const orderFor=dim=>dim==="platform"?platformOrder:dim==="media"?mediaOrder:dim==="original_product"?originalProductOrder:dim==="product"?productOrder:dim==="risk_level"?riskOrder:dim==="credit_limit_bucket"?creditLimitOrder:undefined;
  const trendOrder=orderFor(trendDimension);
  const trendRows=trendDimension==="overall"?p.map(row=>({...row,"T0 (%)":row.t0,"T7 (%)":row.t7})):segmentedTrend(rows,grain,trendDimension,ws,"t0");
  const trendSpec=trendDimension==="overall"?{type:"line",x:"label",y:"T0 (%)",fields:["T0 (%)","T7 (%)"],yLabel:"提现申请率",showValues:true,legend:{labels:{"T0 (%)":"T0提现申请率","T7 (%)":"T7提现申请率"}}}:{type:"line",x:"label",y:"rate",series:"segment",yLabel:"T0提现申请率",showValues:true,tooltipOrder:trendOrder};
  const compositionDimension=trendDimension==="overall"?"media":trendDimension,compositionOrder=orderFor(compositionDimension),compositionRows=creditPassCompositionWide(rows,grain,compositionDimension,compositionOrder),compositionValues=[...new Set(compositionRows.flatMap(row=>Object.keys(row.__compositionDetails??{})))],compositionFields=compositionValues,compositionSpec={type:"stackedBar100",x:"label",y:compositionFields[0]??"share",fields:compositionFields,yLabel:"授信通过人数占比",showValues:false,tooltipOrder:compositionOrder,legend:{labels:Object.fromEntries(compositionValues.map(value=>[value,value]))}};
  const utilRows=utilDimension==="overall"?p:segmentedMetric(rows,grain,utilDimension,ws,"util"),utilSpec=utilDimension==="overall"?{type:"line",x:"label",y:"util",yLabel:"额度使用率"}:{type:"line",x:"label",y:"rate",series:"segment",yLabel:"T0额度使用率",showValues:true,tooltipOrder:orderFor(utilDimension)};
  const avgCreditRows=avgCreditDimension==="overall"?p.filter(x=>x.avgCreditLimit!=null):segmentedMetric(rows,grain,avgCreditDimension,ws,"avgCreditLimit","value"),avgCreditSpec=avgCreditDimension==="overall"?{type:"line",x:"label",y:"avgCreditLimit",yLabel:"人均授信额度（Rp）",valueDecimals:0}:{type:"line",x:"label",y:"value",series:"segment",yLabel:"人均授信额度（Rp）",valueDecimals:0,showValues:true,tooltipOrder:orderFor(avgCreditDimension)};
  const avgLoanRows=avgLoanDimension==="overall"?p.filter(x=>x.avgT0LoanAmount!=null):segmentedMetric(rows,grain,avgLoanDimension,ws,"avgT0LoanAmount","value"),avgLoanSpec=avgLoanDimension==="overall"?{type:"line",x:"label",y:"avgT0LoanAmount",yLabel:"人均放款金额（Rp）",valueDecimals:0}:{type:"line",x:"label",y:"value",series:"segment",yLabel:"人均放款金额（Rp）",valueDecimals:0,showValues:true,tooltipOrder:orderFor(avgLoanDimension)};
  const riskTrend=groups(rows,grain).flatMap(([d,a])=>[...new Set(a.map(r=>r.risk_level))].sort().map(r=>({label:cd(d),risk:r,t0:ws(a.filter(x=>x.risk_level===r)).t0})));
  const riskCreditTrend=groups(rows,grain).flatMap(([d,a])=>[...new Set(a.map(r=>r.risk_level))].sort().map(r=>{const x=ws(a.filter(v=>v.risk_level===r));return{label:cd(d),risk:r,avgCreditLimit:x.avgCreditLimit}}).filter(x=>x.avgCreditLimit!=null));
  const creditBucketRate=groups(rows,grain).flatMap(([d,a])=>[...new Set(a.map(r=>r.credit_limit_bucket).filter(Boolean))].sort().reverse().map(bucket=>{const x=ws(a.filter(v=>v.credit_limit_bucket===bucket));return{label:cd(d),bucket:bucket.replace(/^\d+_/,""),t0:x.t0}}).filter(x=>x.t0!=null));
  const creditBucketShare=groups(rows,grain).flatMap(([d,a])=>{const total=sum(a,"credit_pass_customer_cnt");return[...new Set(a.map(r=>r.credit_limit_bucket).filter(Boolean))].sort().map(bucket=>({label:cd(d),bucket:bucket.replace(/^\d+_/,""),share:ratio(sum(a.filter(v=>v.credit_limit_bucket===bucket),"credit_pass_customer_cnt"),total)??0}))});
  const bucketRows=groups(rows,grain).flatMap(([d,a])=>{const base=a.filter(r=>r.t0_utilization_bucket&&r.t0_utilization_bucket!=="\\N"),total=sum(base,"t0_withdraw_numerator");return["01_100%以下","02_100%及以上"].map(b=>({label:cd(d),bucket:b.replace(/^\d+_/,""),share:ratio(sum(base.filter(r=>r.t0_utilization_bucket===b),"t0_withdraw_numerator"),total)??0}))});
  const credit=riskShares(rows,grain,"credit_pass_customer_cnt"),t0=riskShares(rows,grain,"t0_withdraw_numerator"),creditCount=riskCounts(rows,grain,"credit_pass_customer_cnt"),t0Count=riskCounts(rows,grain,"t0_withdraw_numerator"),stack=(risks)=>({type:"stackedBar100",x:"label",y:"share",series:"risk",yLabel:"客户占比",tooltipOrder:riskOrder,legend:{labels:Object.fromEntries(risks.map(r=>[r,r]))}}),countStack=(risks)=>({type:"stackedBar",x:"label",y:"count",series:"risk",yLabel:"客户数",showValues:false,tooltipOrder:riskOrder,legend:{labels:Object.fromEntries(risks.map(r=>[r,r]))}});
  const newCustomerRows=rows.filter(r=>r.credit_type==="01_首次授信"),versions=versionDistribution(newCustomerRows,grain),versionShareSpec={type:"stackedBar100",x:"label",y:"share",series:"version",yLabel:"客户占比",showValues:false,tooltipOrder:versions.versions},versionCountSpec={type:"stackedBar",x:"label",y:"count",series:"version",yLabel:"客户数",showValues:false,tooltipOrder:versions.versions};
  return <>
    <section className="metric-grid"><M id="credit" q={q} title="昨日通过量" value={num(latest?.credit_pass_customer_cnt)} note={sd(latest?.period)} rows={rows}/><M id="t0" q={q} title="T0提现申请率" value={pct(latest?.t0)} note={`申请人数 ${num(latest?.t0_withdraw_numerator)} / 授信通过人数 ${num(latest?.t0_withdraw_denominator)}`} rows={rows}/><M id="t0-loans" q={q} title="T0放款数" value={num(latest?.t0LoanCustomers)} note="关联昨日通过提现" rows={rows}/><M id="t7" q={q} title="T7提现申请率" value={pct(mature?.t7)} note={`最新成熟日 ${sd(mature?.period)}`} rows={rows}/><M id="util" q={q} title="T0额度使用率" value={pct(latest?.util)} note="申请金额 / 授信额度" rows={rows}/></section>
    <section className="trend-section"><TrendDimensionSelector value={trendDimension} onChange={value=>{cp("withdraw").onVisibleSeriesChange(undefined);setTrendDimension(value)}} options={trendOptions}/><EvidenceChart id="withdraw" queryId={q} title={trendDimension==="overall"?"T0 / T7提现申请率趋势":"各分组T0提现申请率趋势"} spec={trendSpec} rows={trendRows} sourceRows={rows} height={340} chartOptions={{tooltipContent:props=><RateBreakdownTooltip {...props} sourceRows={trendRows} overall={trendDimension==="overall"} order={trendDimension==="overall"?["T0 (%)","T7 (%)"]:trendOrder}/>}} wrapperClassName={trendDimension==="overall"?"withdraw-rate-trend":""} {...cp("withdraw")}/></section>
    <section className="trend-section"><EvidenceChart id="credit-pass-composition" queryId={q} title={trendDimension==="overall"?"授信通过人数渠道结构":`各${dimensionLabels[compositionDimension]??"分组"}授信通过人数结构`} description={`与上方T0申请率使用相同统计粒度；每期合计100%，悬浮查看各${dimensionLabels[compositionDimension]??"分组"}人数、占比及总通过人数。`} spec={compositionSpec} rows={compositionRows} sourceRows={rows} height={320} chartOptions={{tooltipContent:props=><CompositionTooltip {...props} sourceRows={compositionRows} order={compositionOrder}/>}} {...cp("credit-pass-composition")}/></section>
    <section className="trend-section"><TrendDimensionSelector value={utilDimension} onChange={value=>{cp("util-trend").onVisibleSeriesChange(undefined);setUtilDimension(value)}} options={trendOptions}/><EvidenceChart id="util-trend" queryId={q} title={utilDimension==="overall"?"T0额度使用率趋势":"各分组T0额度使用率趋势"} spec={utilSpec} rows={utilRows} sourceRows={rows} height={340} {...cp("util-trend")}/></section>
    <section className="trend-section"><TrendDimensionSelector value={avgCreditDimension} onChange={value=>{cp("avg-credit-limit").onVisibleSeriesChange(undefined);setAvgCreditDimension(value)}} options={trendOptions}/><EvidenceChart id="avg-credit-limit" queryId={q} title={avgCreditDimension==="overall"?"授信通过客户人均授信额度":"各分组授信通过客户人均授信额度趋势"} description="授信通过额度合计 / 授信通过客户数。" spec={avgCreditSpec} rows={avgCreditRows} sourceRows={rows} height={340} {...cp("avg-credit-limit")}/></section>
    <section className="trend-section"><EvidenceChart id="avg-t0-credit-limit" queryId={q} title="T0提现申请客户人均授信额度" description="T0提现申请客户对应授信额度合计 / T0提现申请客户数。" spec={{type:"line",x:"label",y:"avgT0CreditLimit",yLabel:"人均授信额度（Rp）",valueDecimals:0}} rows={p.filter(x=>x.avgT0CreditLimit!=null)} sourceRows={rows} height={300} {...cp("avg-t0-credit-limit")}/></section>
    <section className="trend-section"><TrendDimensionSelector value={avgLoanDimension} onChange={value=>{cp("avg-t0-loan-amount").onVisibleSeriesChange(undefined);setAvgLoanDimension(value)}} options={trendOptions}/><EvidenceChart id="avg-t0-loan-amount" queryId={q} title={avgLoanDimension==="overall"?"T0客户人均放款金额":"各分组T0客户人均放款金额趋势"} description="仅统计正式放款表中未删除订单：实际放款金额合计 / 实际放款客户数。" spec={avgLoanSpec} rows={avgLoanRows} sourceRows={rows} height={340} {...cp("avg-t0-loan-amount")}/></section>
    <section className="distribution-section"><SectionHeader id="risk-head" title="客户风险等级分布"/><div className="chart-grid"><EvidenceChart id="credit-risk" queryId={q} title="授信通过客户风险等级分布" spec={stack(credit.risks)} rows={credit.rows} sourceRows={rows} height={300} {...cp("credit-risk")}/><EvidenceChart id="t0-risk" queryId={q} title="T0提现申请客户风险等级分布" spec={stack(t0.risks)} rows={t0.rows} sourceRows={rows} height={300} {...cp("t0-risk")}/></div><div className="chart-grid risk-number-summary-grid"><EvidenceChart id="credit-risk-count" queryId={q} title="授信通过客户风险等级绝对人数分布" description="按当前统计粒度展开，悬浮可查看各风险等级人数。" spec={countStack(creditCount.risks)} rows={creditCount.rows} sourceRows={rows} height={310} {...cp("credit-risk-count")}/><EvidenceChart id="t0-risk-count" queryId={q} title="T0提现申请客户风险等级绝对人数分布" description="按当前统计粒度展开，悬浮可查看各风险等级人数。" spec={countStack(t0Count.risks)} rows={t0Count.rows} sourceRows={rows} height={310} {...cp("t0-risk-count")}/></div></section>
    <section className="distribution-section"><SectionHeader id="app-version-head" title="客户App版本分布"/><div className="chart-grid"><EvidenceChart id="new-customer-version-share" queryId={q} title="授信通过客户App版本分布" description="仅统计首次授信通过客户；每期各版本占比合计100%。" spec={versionShareSpec} rows={versions.shareRows} sourceRows={newCustomerRows} height={320} {...cp("new-customer-version-share")}/><EvidenceChart id="new-customer-version-count" queryId={q} title="授信通过客户App版本绝对人数分布" description="仅统计首次授信通过客户；保留UNKNOWN版本。" spec={versionCountSpec} rows={versions.countRows} sourceRows={newCustomerRows} height={320} {...cp("new-customer-version-count")}/></div></section>
    <section className="chart-grid distribution-section"><EvidenceChart id="risk-t0-rate" queryId={q} title="各风险等级T0提现申请率" description="展示当前筛选下全部时间。" spec={{type:"line",x:"label",y:"t0",series:"risk",yLabel:"T0提现申请率",tooltipOrder:riskOrder}} rows={riskTrend} sourceRows={rows} height={330} {...cp("risk-t0-rate")}/><EvidenceChart id="risk-credit-limit" queryId={q} title="各风险等级人均授信额度" description="各风险等级授信通过额度合计 / 对应授信通过客户数。" spec={{type:"line",x:"label",y:"avgCreditLimit",series:"risk",yLabel:"人均授信额度（Rp）",valueDecimals:0,showValues:false,tooltipOrder:riskOrder}} rows={riskCreditTrend} sourceRows={rows} height={330} {...cp("risk-credit-limit")}/></section>
    <section className="distribution-section"><SectionHeader id="credit-bucket-head" title="授信额度分桶分布"/><div className="chart-grid"><EvidenceChart id="credit-bucket-t0-rate" queryId={q} title="各授信额度分桶T0提现申请率" description="各额度档位T0申请客户数 / 对应授信通过客户数。" spec={{type:"line",x:"label",y:"t0",series:"bucket",yLabel:"T0提现申请率",showValues:false,tooltipOrder:creditLimitOrder}} rows={creditBucketRate} sourceRows={rows} height={330} {...cp("credit-bucket-t0-rate")}/><EvidenceChart id="credit-bucket-share" queryId={q} title="授信通过客户额度分桶结构" description="按时间展开，每期各额度档位客户占比合计100%。" spec={{type:"stackedBar100",x:"label",y:"share",series:"bucket",yLabel:"客户占比",showValues:false,tooltipOrder:creditLimitOrder,colors:{"30万":"#42a383","40万":"#75b39f","50万":"#9ab7c7","60万":"#8390ad","80万":"#d7a441","100万":"#bd7fa3","120万":"#fa423e","150万":"#8f8f8f","180万":"#6ea6c8","200万及以上":"#527f73"}}} rows={creditBucketShare} sourceRows={rows} height={330} {...cp("credit-bucket-share")}/></div></section>
    <section className="distribution-section"><EvidenceChart id="bucket-share" queryId={q} title="T0额度使用率分组占比" description="按时间展开，每期合计100%。" spec={{type:"stackedBar100",x:"label",y:"share",series:"bucket",yLabel:"客户占比",colors:{"100%以下":"#d78700","100%及以上":"#00a0bf"}}} rows={bucketRows} sourceRows={rows} height={330} {...cp("bucket-share")}/></section>
  </>;
}
function Fpd({rows,grain,cp}){const q="loan_fpd_monitor",p=periods(rows,grain,fs),daily=periods(rows,"day",fs),last=daily.at(-1),f0=daily.filter(x=>x.fpd0_denominator>0).at(-1),f3=daily.filter(x=>x.fpd3_denominator>0).at(-1),line=(dim)=>groups(rows,grain).flatMap(([d,a])=>[...new Set(a.map(r=>r[dim]))].sort().map(v=>{const x=fs(a.filter(r=>r[dim]===v));return{label:cd(d),segment:String(v).replace(/^\d+_/,""),rate:x.f0,den:x.fpd0_denominator}})).filter(x=>x.den>0),risk=line("risk_level"),bucket=line("loan_utilization_bucket"),dist=riskShares(rows,grain,"fpd0_numerator");return <><section className="metric-grid metric-grid--four"><M id="loans" q={q} title="最新放款单量" value={num(last?.loan_order_cnt)} note={sd(last?.period)} rows={rows}/><M id="loan-util" q={q} title="放款额度使用率" value={pct(fs(rows).util)} note="放款总额 / 授信额度总额" rows={rows}/><M id="f0" q={q} title="FPD0订单逾期率" value={pct(f0?.f0)} note={`最新有效日 ${sd(f0?.period)}`} rows={rows}/><M id="f3" q={q} title="FPD3订单逾期率" value={pct(f3?.f3)} note={`最新有效日 ${sd(f3?.period)}`} rows={rows}/></section><section className="chart-grid"><EvidenceChart id="loan-trend" queryId={q} title="放款单量趋势" spec={{type:"line",x:"label",y:"loan_order_cnt",yLabel:"放款订单数"}} rows={p} sourceRows={rows} height={300} {...cp("loan-trend")}/><EvidenceChart id="fpd-order" queryId={q} title="FPD0 / FPD3订单逾期率趋势" spec={{type:"line",x:"label",y:"f0",fields:["f0","f3"],yLabel:"订单逾期率",legend:{labels:{f0:"FPD0",f3:"FPD3"}}}} rows={p} sourceRows={rows} height={300} {...cp("fpd-order")}/></section><section className="chart-grid distribution-section"><EvidenceChart id="fpd-risk-dist" queryId={q} title="FPD0逾期订单风险等级分布" description="近一个月，每期合计100%。" spec={{type:"stackedBar100",x:"label",y:"share",series:"risk",yLabel:"订单占比"}} rows={dist.rows} sourceRows={rows} height={310} {...cp("fpd-risk-dist")}/><EvidenceChart id="fpd-amount" queryId={q} title="FPD0 / FPD3金额逾期率趋势" spec={{type:"line",x:"label",y:"fa0",fields:["fa0","fa3"],yLabel:"金额逾期率",legend:{labels:{fa0:"FPD0",fa3:"FPD3"}}}} rows={p} sourceRows={rows} height={310} {...cp("fpd-amount")}/></section><section className="chart-grid distribution-section"><EvidenceChart id="fpd-risk-rate" queryId={q} title="各风险等级FPD0逾期率趋势" spec={{type:"line",x:"label",y:"rate",series:"segment",yLabel:"FPD0订单逾期率"}} rows={risk} sourceRows={rows} height={330} {...cp("fpd-risk-rate")}/><EvidenceChart id="fpd-bucket-rate" queryId={q} title="各额度使用率分桶FPD0逾期率趋势" spec={{type:"line",x:"label",y:"rate",series:"segment",yLabel:"FPD0订单逾期率"}} rows={bucket} sourceRows={rows} height={330} {...cp("fpd-bucket-rate")}/></section></>}

function Fpd2({rows,grain,cp}){
  const [amountDimension,setAmountDimension]=useState("overall"),[orderDimension,setOrderDimension]=useState("overall"),[loanDimension,setLoanDimension]=useState("overall");
  const q="loan_fpd_monitor",all=periods(rows,grain,fs),daily=periods(rows,"day",fs),last=daily.at(-1);
  const matured=all.filter(x=>x.fpd0_denominator>0||x.fpd10_denominator>0),f0=daily.filter(x=>x.fpd0_denominator>0).at(-1),f10=daily.filter(x=>x.fpd10_denominator>0).at(-1);
  const trendOptions=[{value:"overall",label:"整体"},{value:"platform",label:"平台"},{value:"media",label:"媒体"},{value:"original_product",label:"原始产品"},{value:"product",label:"产品"},{value:"app_version",label:"App版本"},{value:"risk_level",label:"RG"},{value:"loan_type",label:"首复借"},{value:"loan_utilization_bucket",label:"额度使用率桶"}];
  const orderFor=dim=>dim==="platform"?platformOrder:dim==="media"?mediaOrder:dim==="original_product"?originalProductOrder:dim==="product"?productOrder:dim==="risk_level"?riskOrder:dim==="loan_type"?loanTypeOrder:dim==="loan_utilization_bucket"?utilizationOrder:undefined;
  const amountRows=amountDimension==="overall"?matured:segmentedTrend(rows,grain,amountDimension,fs,"fpd0AmountRate"),orderRows=orderDimension==="overall"?matured:segmentedTrend(rows,grain,orderDimension,fs,"fpd0Rate");
  const amountSpec=amountDimension==="overall"?{type:"line",x:"label",y:"fpd0AmountRate",fields:["fpd0AmountRate","fpd10AmountRate"],yLabel:"金额逾期率",legend:{labels:{fpd0AmountRate:"FPD0",fpd10AmountRate:"FPD10"}}}:{type:"line",x:"label",y:"rate",series:"segment",yLabel:"FPD0金额逾期率",showValues:true,tooltipOrder:orderFor(amountDimension)};
  const orderSpec=orderDimension==="overall"?{type:"line",x:"label",y:"fpd0Rate",fields:["fpd0Rate","fpd10Rate"],yLabel:"订单逾期率",legend:{labels:{fpd0Rate:"FPD0",fpd10Rate:"FPD10"}}}:{type:"line",x:"label",y:"rate",series:"segment",yLabel:"FPD0订单逾期率",showValues:true,tooltipOrder:orderFor(orderDimension)};
  const loanRows=loanDimension==="overall"?all:groups(rows,grain).flatMap(([d,a])=>[...new Set(a.map(r=>dimensionValue(r,loanDimension)).filter(Boolean))].map(value=>({label:cd(d),segment:String(value).replace(/^\d+_/,""),count:sum(a.filter(r=>dimensionValue(r,loanDimension)===value),"loan_order_cnt")})).filter(x=>x.count>0));
  const loanSpec=loanDimension==="overall"?{type:"line",x:"label",y:"loan_order_cnt",yLabel:"放款订单数"}:{type:"line",x:"label",y:"count",series:"segment",yLabel:"放款订单数",showValues:true,tooltipOrder:orderFor(loanDimension)};
  const segmentRows=dim=>groups(rows,grain).flatMap(([d,a])=>[...new Set(a.map(r=>r[dim]))].sort().map(v=>{const x=fs(a.filter(r=>r[dim]===v));return{label:cd(d),segment:String(v).replace(/^\d+_/,""),fpd0Rate:x.fpd0Rate,fpd0AmountRate:x.fpd0AmountRate,den:x.fpd0_denominator}})).filter(x=>x.den>0);
  return <><section className="metric-grid metric-grid--four"><M id="loans" q={q} title="最新放款单量" value={num(last?.loan_order_cnt)} note={sd(last?.period)} rows={rows}/><M id="loan-util" q={q} title="放款额度使用率" value={pct(fs(rows).util)} note="放款总额 / 授信额度总额" rows={rows}/><M id="f0" q={q} title="FPD0订单逾期率" value={pct(f0?.fpd0Rate)} note={`最新有效日 ${sd(f0?.period)}`} rows={rows}/><M id="f10" q={q} title="FPD10订单逾期率" value={pct(f10?.fpd10Rate)} note={`最新有效日 ${sd(f10?.period)}`} rows={rows}/></section>
  <section className="trend-section"><TrendDimensionSelector value={amountDimension} onChange={value=>{cp("fpd-amount").onVisibleSeriesChange(undefined);setAmountDimension(value)}} options={trendOptions}/><EvidenceChart id="fpd-amount" queryId={q} title={amountDimension==="overall"?"FPD0 / FPD10金额逾期率趋势":"各分组FPD0金额逾期率趋势"} description="未进入观察期的日期不展示。" spec={amountSpec} rows={amountRows} sourceRows={rows} height={340} chartOptions={amountDimension==="overall"?{tooltipContent:props=><RateBreakdownTooltip {...props} sourceRows={amountRows} overall order={["FPD0金额逾期率","FPD10金额逾期率"]}/>}:{}} {...cp("fpd-amount")}/></section>
  <section className="trend-section"><TrendDimensionSelector value={orderDimension} onChange={value=>{cp("fpd-order").onVisibleSeriesChange(undefined);setOrderDimension(value)}} options={trendOptions}/><EvidenceChart id="fpd-order" queryId={q} title={orderDimension==="overall"?"FPD0 / FPD10订单逾期率趋势":"各分组FPD0订单逾期率趋势"} description="未进入观察期的日期不展示。" spec={orderSpec} rows={orderRows} sourceRows={rows} height={340} {...cp("fpd-order")}/></section>
  <section className="trend-section distribution-section"><TrendDimensionSelector value={loanDimension} onChange={value=>{cp("loan-trend").onVisibleSeriesChange(undefined);setLoanDimension(value)}} options={trendOptions}/><EvidenceChart id="loan-trend" queryId={q} title={loanDimension==="overall"?"放款单量趋势":"各分组放款单量趋势"} spec={loanSpec} rows={loanRows} sourceRows={rows} height={320} {...cp("loan-trend")}/></section>
  <section className="chart-grid distribution-section"><EvidenceChart id="fpd-risk-rate" queryId={q} title="各风险等级FPD0逾期率趋势" spec={{type:"line",x:"label",y:"fpd0Rate",series:"segment",yLabel:"FPD0订单逾期率",tooltipOrder:riskOrder}} rows={segmentRows("risk_level")} sourceRows={rows} height={330} {...cp("fpd-risk-rate")}/><EvidenceChart id="fpd-risk-amount-rate" queryId={q} title="各风险等级FPD0金额逾期率趋势" spec={{type:"line",x:"label",y:"fpd0AmountRate",series:"segment",yLabel:"FPD0金额逾期率",tooltipOrder:riskOrder}} rows={segmentRows("risk_level")} sourceRows={rows} height={330} {...cp("fpd-risk-amount-rate")}/></section>
  <section className="chart-grid distribution-section"><EvidenceChart id="fpd-bucket-rate" queryId={q} title="各额度使用率分桶FPD0逾期率趋势" spec={{type:"line",x:"label",y:"fpd0Rate",series:"segment",yLabel:"FPD0订单逾期率"}} rows={segmentRows("loan_utilization_bucket")} sourceRows={rows} height={330} {...cp("fpd-bucket-rate")}/><EvidenceChart id="fpd-bucket-amount-rate" queryId={q} title="各额度使用率分桶FPD0金额逾期率趋势" spec={{type:"line",x:"label",y:"fpd0AmountRate",series:"segment",yLabel:"FPD0金额逾期率"}} rows={segmentRows("loan_utilization_bucket")} sourceRows={rows} height={330} {...cp("fpd-bucket-amount-rate")}/></section></>
}
