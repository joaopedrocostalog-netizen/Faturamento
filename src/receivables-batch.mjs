/** Busca Contas a Receber por meses para não enviar um ano inteiro ao DSS.
 * Resultado só é devolvido quando TODOS os intervalos retornarem sem erro.
 * Sem cache de token, sem consulta a outros endpoints e sem registros parciais.
 */
import {validDate} from './e-documents.mjs';
import {fetchAuthorizedReceivables} from './dss-sync.mjs';

export function receivableWindows(from,to){
 if(!validDate(from)||!validDate(to)||from>to)throw Error('Período inválido: confira as datas.');
 const out=[];
 let year=Number(from.slice(0,4)),month=Number(from.slice(5,7));
 const endYear=Number(to.slice(0,4)),endMonth=Number(to.slice(5,7));
 while(year<endYear||(year===endYear&&month<=endMonth)){
  const monthStart=year+'-'+String(month).padStart(2,'0')+'-01';
  const monthEnd=new Date(Date.UTC(year,month,0)).toISOString().slice(0,10);
  out.push({from:out.length===0?from:monthStart,to:monthEnd>to?to:monthEnd});
  if(out.length>15)throw Error('Selecione no máximo 12 meses de contas a receber por consulta.');
  month++;if(month===13){month=1;year++;}
 }
 return out;
}
function halfWindows({from,to}){
 const start=new Date(from+'T12:00:00Z').getTime();
 const end=new Date(to+'T12:00:00Z').getTime();
 if(!Number.isFinite(start)||end-start<86400000)return null;
 const midpoint=Math.floor((start+end)/2/86400000)*86400000+12*3600000;
 const mid=new Date(midpoint).toISOString().slice(0,10);
 const next=new Date(midpoint+86400000).toISOString().slice(0,10);
 if(mid<from||next>to)return null;
 return [{from,to:mid},{from:next,to}];
}
export async function loadReceivablesByPeriod({token,from,to,tipoRef='E',
 fetchPage=fetchAuthorizedReceivables,onProgress=()=>{},concurrency=1}){
 const windows=receivableWindows(from,to),parts=new Array(windows.length);
 let index=0,done=0;
 const get=async range=>{
  try{return await fetchPage({token,from:range.from,to:range.to,tipoRef});}
  catch(e){
   const halfs=/tempo limite|timeout|periodo menor|período menor/i.test(String(e?.message||''))?halfWindows(range):null;
   if(!halfs)throw Error('DSS '+range.from+' a '+range.to+': '+String(e?.message||'Falha na consulta.'));
   const first=await fetchPage({token,from:halfs[0].from,to:halfs[0].to,tipoRef});
   const second=await fetchPage({token,from:halfs[1].from,to:halfs[1].to,tipoRef});
   return first.concat(second);
  }
 };
 const worker=async()=>{
  while(index<windows.length){
   const n=index++;const range=windows[n];
   parts[n]=await get(range);
   done++;
   onProgress(done,windows.length,range);
  }
 };
 await Promise.all(Array.from({length:Math.min(2,Math.max(1,Number(concurrency)||1),windows.length)},worker));
 return parts.flat();
}
