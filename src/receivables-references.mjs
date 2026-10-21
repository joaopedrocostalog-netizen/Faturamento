/** Consultas independentes por referência DSS no mesmo clique de sincronização.
 * E=emissão, V=vencimento, P=pagamento (apenas parcelas pagas). Não unir resultados
 * de referências diferentes, não guardar token ou registros persistidos no navegador.
 */
import {loadReceivablesByPeriod} from './receivables-batch.mjs';
export const RECEIVABLE_REFERENCES=Object.freeze(['E','V','P']);
const warning=e=>String(e?.message||'Consulta indisponível').slice(0,230);
export function referenceSelection(cache,ref='E'){
 if(!RECEIVABLE_REFERENCES.includes(ref))throw Error('Referência de período inválida.');
 const value=cache?.[ref];
 if(!value)return {rows:[],source:'pending',error:'',reference:ref};
 return {rows:value.records||[],source:value.ok?'live':'unavailable',
  error:value.ok?'':'Referência '+ref+' não disponível: '+String(value.message||'Falha na consulta.'),
  reference:ref};
}
export async function loadReceivableReferences({token,from,to,load=loadReceivablesByPeriod,onProgress=()=>{}}){
 const result={};
 // Consulta por referência independente; uma falha não contamina outra.
 await Promise.all(RECEIVABLE_REFERENCES.map(async (ref)=>{
  try{
   const records=await load({token,from,to,tipoRef:ref,concurrency:1,
    onProgress(done,total){onProgress(ref,done,total);}});
   if(!Array.isArray(records))throw Error('Resposta inválida do DSS para '+ref);
   result[ref]={ok:true,records};
  }catch(e){result[ref]={ok:false,records:[],message:warning(e)};}
 }));
 return result;
}
