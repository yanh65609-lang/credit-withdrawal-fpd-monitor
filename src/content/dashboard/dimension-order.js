export function fixedDimensionOrder(values, preferred = []) {
  const unique=[...new Set(values.filter(value=>value!=null).map(String))];
  const natural=(a,b)=>a.localeCompare(b,'en',{numeric:true});
  const ranks=new Map(preferred.map((value,index)=>[String(value),index]));
  return unique.sort((a,b)=>{
    const missingA=['UNKNOWN','未知','空值'].includes(a),missingB=['UNKNOWN','未知','空值'].includes(b);
    if(missingA!==missingB)return missingA?1:-1;
    const rankA=ranks.get(a),rankB=ranks.get(b);
    if(rankA!==undefined||rankB!==undefined)return(rankA??999)-(rankB??999)||natural(a,b);
    return natural(a,b);
  });
}
