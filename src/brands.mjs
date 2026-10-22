/**
 * Contextos corporativos mutuamente exclusivos.
 * Nunca usar o cliente/parceiro para determinar a empresa emissora.
 * Dados sem empresa reconhecida não pertencem a nenhum dos ambientes.
 */
import {companyOfOperation,companyOfReceivable,COMPANY_UNIDENTIFIED,COMPANY_ALL} from './companies.mjs';
export const BRANDS=Object.freeze({
 costalog:Object.freeze({id:'costalog',name:'COSTALOG',subtitle:'A LOGÍSTICA IDEAL',
  logo:'./logo-costalog-sem-fundo-1024x876.png',
  companies:Object.freeze(['A.C DA COSTA DELIBERALI','COMEX COSTA LOG','CRC COSTA'])}),
 ideallog:Object.freeze({id:'ideallog',name:'IDEALLOG',subtitle:'GESTÃO DE FATURAMENTO',
  logo:'./Ideallog.png',companies:Object.freeze(['IDEALLOG'])})
});
export const validBrand=brand=>brand==='ideallog'?'ideallog':'costalog';
export const brandConfig=brand=>BRANDS[validBrand(brand)];
export const brandCompanies=brand=>brandConfig(brand).companies;
export function validSelectedCompany(brand,company){
 return company!==COMPANY_ALL&&brandCompanies(brand).includes(company)?company:COMPANY_ALL;
}
export function recordInBrand(row,brand){
 return brandCompanies(brand).includes(companyOfReceivable(row));
}
const rowCache=new WeakMap();
export function scopeReceivables(rows,brand,company=COMPANY_ALL){
 if(!Array.isArray(rows))return [];
 const selected=validSelectedCompany(brand,company),key=validBrand(brand)+':'+selected;
 let hit=rowCache.get(rows);if(!hit){hit=new Map();rowCache.set(rows,hit);}
 if(!hit.has(key))hit.set(key,rows.filter(row=>recordInBrand(row,brand)&&
  (selected===COMPANY_ALL||companyOfReceivable(row)===selected)));
 return hit.get(key);
}
const operationalCache=new WeakMap();
export function scopeOverview(data,brand,company=COMPANY_ALL){
 if(!data)return {viagens:[],pedidos:[],ctes:[],mdfes:[],ocorrencias:[],sources:{}};
 const selected=validSelectedCompany(brand,company),key=validBrand(brand)+':'+selected;
 let hit=operationalCache.get(data);if(!hit){hit=new Map();operationalCache.set(data,hit);}
 if(hit.has(key))return hit.get(key);
 const keep=r=>recordInBrand(r,brand)&&(selected===COMPANY_ALL||companyOfOperation(r)===selected);
 const rows=k=>(data[k]||[]).filter(keep);
 const result={...data,viagens:rows('viagens'),pedidos:rows('pedidos'),ctes:rows('ctes'),
  allViagens:(data.allViagens||data.viagens||[]).filter(keep),
  // Sem campo empresa: não atribuir MDF-e ou ocorrências a outro ambiente.
  mdfes:[],ocorrencias:[],sources:{...data.sources,mdfes:false,ocorrencias:false}};
 hit.set(key,result);return result;
}
const normalizeRef=v=>String(v??'').normalize('NFKC').trim().toUpperCase().replace(/\s+/g,' ');
const validRef=v=>!!v&&!['0','—','-','NULL','NÃO INFORMADO','NAO INFORMADO'].includes(v);
function makeOwnerIndex(data,receivables){
 const invoices=new Map(),nfs=new Map();
 const add=(index,key,company)=>{
  const normalized=normalizeRef(key);
  if(!validRef(normalized)||company===COMPANY_UNIDENTIFIED)return;
  if(!index.has(normalized))index.set(normalized,new Set());
  index.get(normalized).add(company);
 };
 for(const row of data?.pedidos||[]){
  const company=companyOfOperation(row);
  add(invoices,row.numeroFatura,company);add(nfs,row.numeroNfse,company);
 }
 for(const row of receivables||[])add(invoices,row.fatura,companyOfReceivable(row));
 return {invoices,nfs};
}
const docCache=new WeakMap();
/** Only documents with a unique consistent issuing-company match may be shown.
 * If invoice and NFS-e map to different companies, mark ambiguous and hide.
 * Never derive issuer from document "parceiro".
 */
export function scopeDocuments(documents,overview,receivables,brand,company=COMPANY_ALL){
 if(!Array.isArray(documents))return {rows:[],unassigned:0,other:0};
 const selected=validSelectedCompany(brand,company),key=validBrand(brand)+':'+selected;
 let bucket=docCache.get(documents);if(!bucket){bucket=[];docCache.set(documents,bucket);}
 const previous=bucket.find(e=>e.key===key&&e.overview===overview&&e.receivables===receivables);
 if(previous)return previous.result;
 const owners=makeOwnerIndex(overview,receivables);
 let unassigned=0,other=0;
 const rows=documents.filter(doc=>{
  const sets=[];
  const explicit=companyOfReceivable(doc);
  if(explicit!==COMPANY_UNIDENTIFIED)sets.push(new Set([explicit]));
  const invoice=owners.invoices.get(normalizeRef(doc.fatura));
  const nfs=owners.nfs.get(normalizeRef(doc.numeroNfse));
  if(invoice)sets.push(invoice);
  if(nfs)sets.push(nfs);
  if(!sets.length){unassigned++;return false;}
  const union=new Set(sets.flatMap(s=>[...s]));
  if(union.size!==1){unassigned++;return false;}
  const owner=[...union][0];
  if(!brandCompanies(brand).includes(owner)||(selected!==COMPANY_ALL&&owner!==selected)){other++;return false;}
  return true;
 });
 const result={rows,unassigned,other};
 bucket.push({key,overview,receivables,result});
 if(bucket.length>8)bucket.shift();
 return result;
}
