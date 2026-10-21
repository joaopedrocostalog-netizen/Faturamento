/** Indicadores de faturas: fonte exclusiva /listarContasReceber.
 * Não somar valorTotal por parcela: o total da fatura pode se repetir em cada linha.
 * O valor de cada parcela, o valor recebido e o residual são medidas DISTINTAS.
 */
import {receivablesSummary,isPaidStatus} from './receivables.mjs';
import {companyOfReceivable,receivablesByCompany,COSTALOG_COMPANIES,COMPANY_UNIDENTIFIED} from './companies.mjs';
const canonical=v=>String(v??'').normalize('NFKC').trim().toUpperCase().replace(/\s+/g,' ');
const realNumber=v=>typeof v==='number'&&Number.isFinite(v);
export function invoiceSummary(rows=[],opts={}){
 const list=Array.isArray(rows)?rows:[],now=opts.today||new Date().toISOString().slice(0,10);
 const financial=receivablesSummary(list,{today:now});
 const byInvoice=new Map();let invoicesWithoutNumber=0,invoiceStatusMissing=0;
 for(const r of list){
  const code=canonical(r.fatura);
  if(!code||code==='0'||code==='—'||code==='-'){invoicesWithoutNumber++;continue;}
  const company=companyOfReceivable(r),key=JSON.stringify([company,code]);
  let item=byInvoice.get(key);
  if(!item){item={company,reference:code,count:0,paidStatus:true,hasResidual:false,overdue:false,
   nominal:0,nominalKnown:0,received:0,receivedKnown:0,residual:0,residualKnown:0};byInvoice.set(key,item);}
  item.count++;
  if(!isPaidStatus(r.situacaoFatura))item.paidStatus=false;
  if(!r.situacaoFatura)invoiceStatusMissing++;
  if(realNumber(r.valor)){item.nominal+=r.valor;item.nominalKnown++;}
  if(realNumber(r.valorPagamento)){item.received+=r.valorPagamento;item.receivedKnown++;}
  if(realNumber(r.valorResidual)){
   item.residual+=r.valorResidual;item.residualKnown++;
   if(r.valorResidual>0){
    item.hasResidual=true;
    if(r.dataVencimento&&r.dataVencimento<now)item.overdue=true;
   }
  }
 }
 const invoices=[...byInvoice.values()];
 return {
  invoices:invoices.length,
  installments:list.length,
  invoicesWithoutNumber,
  paidInvoices:invoices.filter(x=>x.paidStatus&&x.count>0).length,
  invoicesWithConfirmedBalance:invoices.filter(x=>x.hasResidual).length,
  invoicesOverdue:invoices.filter(x=>x.overdue).length,
  invoiceStatusMissing,
  ...financial
 };
}
export function invoiceDistributionByCompany(rows=[],opts={}){
 return [...COSTALOG_COMPANIES,COMPANY_UNIDENTIFIED].map(name=>{
  const s=invoiceSummary(receivablesByCompany(rows,name),opts);
  return {name,count:s.invoices,installments:s.installments,residual:s.residual,received:s.paid,nominal:s.face};
 });
}
