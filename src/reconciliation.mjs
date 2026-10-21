/** Conciliação de referências, não validação fiscal nem comprovação de pagamento.
 * Referências são comparadas literalmente após aparar espaços/maiúsculas; não cruzar cliente,
 * valor ou datas como identificadores. A empresa é tomada SOMENTE do pedido.
 */
import {companyOfOperation,COMPANY_ALL} from './companies.mjs';
const ref=v=>String(v??'').normalize('NFKC').trim().toUpperCase().replace(/\s+/g,' ');
const valid=v=>ref(v)&&!['0','-','—','NÃO INFORMADO','NAO INFORMADO'].includes(ref(v));
const index=(rows,key)=>{
 const idx=new Map();
 for(const row of rows){const k=ref(row[key]);if(!valid(k))continue;
  if(!idx.has(k))idx.set(k,[]);idx.get(k).push(row);}
 return idx;
};
const cache=new WeakMap();
export function reconcileFreightDocuments(orders,documents,receivables=[],opts={}){
 const docLive=opts.docsSource==='live',recvLive=opts.recvSource==='live';
 const orderRows=Array.isArray(orders)?orders:[],docRows=docLive&&Array.isArray(documents)?documents:[],
  recvRows=recvLive&&Array.isArray(receivables)?receivables:[];
 let memo=cache.get(orderRows);
 const token=[documents,receivables,docLive,recvLive];
 if(memo&&memo.token.every((x,i)=>x===token[i]))return memo.result;
 const byInvoice=index(docRows,'fatura'),byNfse=index(docRows,'numeroNfse'),
  receivableByInvoice=index(recvRows,'fatura');
 const entries=orderRows.map((order,i)=>{
  const invoice=ref(order.numeroFatura),nfs=ref(order.numeroNfse),company=companyOfOperation(order);
  const invoiceMatches=valid(invoice)?byInvoice.get(invoice)||[]:[],
   nfsMatches=valid(nfs)?byNfse.get(nfs)||[]:[];
  let candidates=[];
  if(docLive){
   if(valid(invoice)&&valid(nfs)&&invoiceMatches.length&&nfsMatches.length){
    const set=new Set(nfsMatches);candidates=invoiceMatches.filter(x=>set.has(x));
   }else candidates=invoiceMatches.length?invoiceMatches:nfsMatches;
  }
  // Unique document reference may be shared between multiple orders (one invoice for many freights).
  // Company ambiguity across those orders must never be silently resolved.
  let status='sem_referencia',reason='Pedido não informa fatura nem número de NFS-e';
  let doc=null,method='',matchId='';
  if(!docLive){status='nao_consultado';reason='Notas fiscais ainda não foram sincronizadas';}
  else if(!valid(invoice)&&!valid(nfs)){status='sem_referencia';}
  else if(candidates.length===0){
   const conflicting=invoiceMatches.length>0&&nfsMatches.length>0;
   status=conflicting?'conferir':'sem_correspondencia';
   reason=conflicting?'A fatura e a NFS-e do pedido apontam para notas diferentes':
    'Nenhum documento com a mesma referência dentro do período consultado';
  }else if(candidates.length!==1){
   status='conferir';reason='Mais de um documento possui esta referência; vínculo ambíguo';
  }else{
   doc=candidates[0];
   method=invoiceMatches.includes(doc)?'Número da fatura':'Número da NFS-e';
   const conflictingInvoice=valid(invoice)&&valid(doc.fatura)&&ref(doc.fatura)!==invoice;
   const conflictingNfs=valid(nfs)&&valid(doc.numeroNfse)&&ref(doc.numeroNfse)!==nfs;
   if(conflictingInvoice||conflictingNfs){
    status='conferir';reason='Os números de fatura ou NFS-e não coincidem entre os registros';doc=null;
   }else{
    status='vinculado';reason='Referência idêntica: '+method;matchId=String(doc.id||doc.numeroNfse||'');
   }
  }
  const installments=recvLive&&valid(invoice)?
    (receivableByInvoice.get(invoice)||[]).filter(x=>companyOfOperation(x)===company):[];
  return {id:String(order.id??i),pedido:String(order.pedidoNumero||order.numero||''),cte:String(order.cteNumero||''),
    company,cliente:String(order.cliente||''),data:order.data||'',fatura:String(order.numeroFatura||''),
    numeroNfse:String(order.numeroNfse||''),valor:Number.isFinite(order.valor)?order.valor:null,
    status,reason,method,doc,matchId,installments:installments.length,
    receivablesAvailable:recvLive};
 });
 // One document can relate to many orders from the same company; flag cross-company use.
 const companiesByDocument=new Map();
 for(const e of entries.filter(x=>x.status==='vinculado')){
  if(!companiesByDocument.has(e.doc))companiesByDocument.set(e.doc,new Set());
  companiesByDocument.get(e.doc).add(e.company);
 }
 for(const e of entries){
  if(e.status==='vinculado'&&companiesByDocument.get(e.doc)?.size>1){
   e.status='conferir';e.reason='Mesma NFS-e relacionada a pedidos de empresas diferentes';e.doc=null;e.matchId='';
  }
 }
 const summary=Object.fromEntries(['vinculado','conferir','sem_correspondencia','sem_referencia','nao_consultado'].map(k=>[k,entries.filter(x=>x.status===k).length]));
 const result={entries,summary,docsAvailable:docLive,receivablesAvailable:recvLive,documentsCount:docRows.length,ordersCount:orderRows.length};
 cache.set(orderRows,{token,result});return result;
}
export function filteredReconciliation(result,state){
 const company=state.recvCompany||COMPANY_ALL,q=String(state.reconSearch||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().trim(),
  status=state.reconStatus||'todos';
 let out=result.entries.filter(row=>(company===COMPANY_ALL||row.company===company)&&
  (status==='todos'||row.status===status)&&
  (!q||[row.pedido,row.cte,row.cliente,row.fatura,row.numeroNfse,row.company,row.reason,row.doc?.numeroNfse].some(v=>
   String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().includes(q))));
 if(state.reconOrder==='valor')out=out.sort((a,b)=>(b.valor??-1)-(a.valor??-1));
 else if(state.reconOrder==='data')out=out.sort((a,b)=>(b.data||'').localeCompare(a.data||''));
 else out=out.sort((a,b)=>({conferir:0,sem_correspondencia:1,sem_referencia:2,vinculado:3,nao_consultado:4}[a.status]??5)-
 ({conferir:0,sem_correspondencia:1,sem_referencia:2,vinculado:3,nao_consultado:4}[b.status]??5)||
 (b.data||'').localeCompare(a.data||''));
 return out;
}
