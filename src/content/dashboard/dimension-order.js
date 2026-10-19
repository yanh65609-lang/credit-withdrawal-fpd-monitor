export function fixedDimensionOrder(values, preferred = []) {
  const unique=[...new Set(values.filter(value=>value!=null).map(String))];
  const known=unique.filter(value=>!['UNKNOWN','未知','空值'].includes(value));
  const natural=(a,b)=>a.localeCompare(b,'en',{numeric:true});
  const ascending=known.length>0&&known.every(value=>/^RG\d+(?:-\d+)?$|^CL_\d+$|^\d+(?:\.\d+)+$/.test(value));
  const ranks=new Map(preferred.map((value,index)=>[String(value),index]));
  return unique.sort((a,b)=>{
    const missingA=['UNKNOWN','未知','空值'].includes(a),missingB=['UNKNOWN','未知','空值'].includes(b);
    if(missingA!==missingB)return missingA?1:-1;
    return ascending?natural(a,b):(ranks.get(a)??999)-(ranks.get(b)??999)||natural(a,b);
  });
}
