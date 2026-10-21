/** Contas a Receber: indicadores da API, sem somar fretes nem adivinhar valores ausentes. */
import {receivablesSummary,isPaidStatus} from './receivables.mjs';
import {companyOfReceivable,receivablesByCompany,COSTALOG_COMPANIES,COMPANY_UNIDENTIFIED} from './companies.mjs';
const canonical=v=>String(v??'').normalize('NFKC').trim().toUpperCase().replace(/\s+/g,' ');
const number=v=>typeof v==='number'&&Number.isFinite(v);
export function invoiceSummary(rows=[],opts={}){
 const list=Array.isArray(rows)?rows:[],now=opts.today||new Date().toISOString().slice(0,10);
 const financial=receivablesSummary(list,{today:now});
 const validReference=row=>{
  const code=canonical(row?.fatura);
  return !!code&&!['0','—','-','NÃO INFORMADO','NAO INFORMADO'].includes(code);
 };
 const numberedRows=list.filter(validReference);
 const noNumberRows=list.filter(row=>!validReference(row));
 const numberedSummary=receivablesSummary(numberedRows,{today:now});
 const noNumberSummary=receivablesSummary(noNumberRows,{today:now});
 const byInvoice=new Map();
 let invoicesWithoutNumber=0,invoiceStatusMissing=0;
 let reportedTotalRows=0,reportedTotalRowsKnown=0,reportedTotalWithoutInvoice=0;
 for(const r of list){
  if(number(r.valorTotal)){reportedTotalRows+=r.valorTotal;reportedTotalRowsKnown++;}
  const code=canonical(r.fatura);
  if(!validReference(r)){
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
  // As linhas sem fatura continuam disponíveis para auditoria, mas não integram
  // os totais exibidos como "valores de faturas identificadas".
  referenceAudit:{
   identified:{count:numberedRows.length,face:numberedSummary.face,faceKnown:numberedSummary.faceKnown,
    residual:numberedSummary.residual,residualKnown:numberedSummary.residualKnown,
    paid:numberedSummary.paid,paidKnown:numberedSummary.paidKnown},
   unidentified:{count:noNumberRows.length,face:noNumberSummary.face,faceKnown:noNumberSummary.faceKnown,
    residual:noNumberSummary.residual,residualKnown:noNumberSummary.residualKnown,
    paid:noNumberSummary.paid,paidKnown:noNumberSummary.paidKnown}
  },
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

/** Comparação de perímetros SEM alterar o filtro escolhido nem ocultar uma empresa.
 * O relatório de referência pode excluir a COMEX, mas isso ainda precisa ser confirmado.
 */
export function invoicePerimeterComparison(rows=[],opts={}){
 const companies=['A.C DA COSTA DELIBERALI','CRC COSTA','IDEALLOG'];
 const all=invoiceSummary(rows,opts);
 const withoutComex=invoiceSummary(rows.filter(row=>companies.includes(companyOfReceivable(row))),opts);
 return {all,withoutComex,excludedCompany:'COMEX COSTA LOG',companies};
}
