/** Contas a Receber: indicadores da API, sem somar fretes nem adivinhar valores ausentes. */
import {receivablesSummary,isPaidStatus} from './receivables.mjs';
import {companyOfReceivable,receivablesByCompany,COSTALOG_COMPANIES,COMPANY_UNIDENTIFIED} from './companies.mjs';
const canonical=v=>String(v??'').normalize('NFKC').trim().toUpperCase().replace(/\s+/g,' ');
const number=v=>typeof v==='number'&&Number.isFinite(v);
export function invoiceSummary(rows=[],opts={}){
 const list=Array.isArray(rows)?rows:[],now=opts.today||new Date().toISOString().slice(0,10);
 const financial=receivablesSummary(list,{today:now});
 const byInvoice=new Map();
 let invoicesWithoutNumber=0,invoiceStatusMissing=0;
 let reportedTotalRows=0,reportedTotalRowsKnown=0,reportedTotalWithoutInvoice=0;
 for(const r of list){
  if(number(r.valorTotal)){reportedTotalRows+=r.valorTotal;reportedTotalRowsKnown++;}
  const code=canonical(r.fatura);
  if(!code||code==='0'||code==='—'||code==='-'){
   invoicesWithoutNumber++;
   if(number(r.valorTotal))reportedTotalWithoutInvoice++;
   continue;
  }
  const company=companyOfReceivable(r),key=JSON.stringify([company,code]);
  let item=byInvoice.get(key);
  if(!item){
   item={company,reference:code,count:0,paidStatus:true,hasResidual:false,overdue:false,
    nominal:0,nominalKnown:0,received:0,receivedKnown:0,residual:0,residualKnown:0,
    reportedTotals:new Set(),reportedTotalKnown:0};
   byInvoice.set(key,item);
  }
  item.count++;
  if(number(r.valorTotal)){
   item.reportedTotals.add(Math.round(r.valorTotal*100));
   item.reportedTotalKnown++;
  }
  if(!isPaidStatus(r.situacaoFatura))item.paidStatus=false;
  if(!r.situacaoFatura)invoiceStatusMissing++;
  if(number(r.valor)){item.nominal+=r.valor;item.nominalKnown++;}
  if(number(r.valorPagamento)){item.received+=r.valorPagamento;item.receivedKnown++;}
  if(number(r.valorResidual)){
   item.residual+=r.valorResidual;item.residualKnown++;
   if(r.valorResidual>0){
    item.hasResidual=true;
    if(r.dataVencimento&&r.dataVencimento<now)item.overdue=true;
   }
  }
 }
 const invoices=[...byInvoice.values()];
 let reportedTotalByInvoice=0,reportedTotalInvoicesKnown=0,reportedTotalInvoicesConflicting=0,
  reportedTotalInvoicesPartiallyFilled=0,reportedTotalInvoicesMissing=0;
 for(const item of invoices){
  if(item.reportedTotals.size>1){reportedTotalInvoicesConflicting++;continue;}
  if(item.reportedTotals.size===0){reportedTotalInvoicesMissing++;continue;}
  if(item.reportedTotalKnown<item.count){reportedTotalInvoicesPartiallyFilled++;continue;}
  reportedTotalByInvoice+=[...item.reportedTotals][0]/100;
  reportedTotalInvoicesKnown++;
 }
 return {
  invoices:invoices.length,installments:list.length,invoicesWithoutNumber,
  paidInvoices:invoices.filter(x=>x.paidStatus&&x.count>0).length,
  invoicesWithConfirmedBalance:invoices.filter(x=>x.hasResidual).length,
  invoicesOverdue:invoices.filter(x=>x.overdue).length,invoiceStatusMissing,
  ...financial,
  totalAudit:{
   parcelValueTotal:financial.face,parcelValueKnown:financial.faceKnown,
   reportedTotalRows,reportedTotalRowsKnown,reportedTotalWithoutInvoice,
   reportedTotalByInvoice,reportedTotalInvoicesKnown,
   reportedTotalInvoicesConflicting,reportedTotalInvoicesPartiallyFilled,
   reportedTotalInvoicesMissing,
   reportedTotalInvoicesNotCounted:reportedTotalInvoicesConflicting+
    reportedTotalInvoicesPartiallyFilled+reportedTotalInvoicesMissing,
   deltaBetweenFields:Math.round((reportedTotalByInvoice-financial.face)*100)/100
  }
 };
}
export function invoiceDistributionByCompany(rows=[],opts={}){
 return [...COSTALOG_COMPANIES,COMPANY_UNIDENTIFIED].map(name=>{
  const s=invoiceSummary(receivablesByCompany(rows,name),opts);
  return {name,count:s.invoices,installments:s.installments,residual:s.residual,received:s.paid,nominal:s.face};
 });
}
