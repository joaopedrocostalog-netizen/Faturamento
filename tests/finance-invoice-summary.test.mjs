import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {invoiceSummary,invoiceDistributionByCompany,invoicePerimeterComparison} from '../src/invoice-summary.mjs';
import {normalizeReceivables} from '../src/receivables.mjs';
import {renderFinanceDashboard} from '../src/financial-ui.mjs';
import {renderCompanyFilter} from '../src/receivables-ui.mjs';
const rows=normalizeReceivables({status:200,registros:[
 {empresa:'CRC COSTA',fatura:'F-100',parcela:'1/2',situacaoFatura:'Aberto',dataVencimento:'2026-10-01',
  valor:100,valorPagamento:null,valorResidual:100,valorTotal:200},
 {empresa:'CRC COSTA',fatura:'F-100',parcela:'2/2',situacaoFatura:'Pago',dataVencimento:'2026-10-15',
  valor:100,valorPagamento:100,valorResidual:null,valorTotal:200},
 {empresa:'CRC COSTA',fatura:'F-200',parcela:'1/1',situacaoFatura:'Pago',dataVencimento:'2026-10-05',
  valor:300,valorPagamento:300,valorResidual:0,valorTotal:300},
 {empresa:'IDEALLOG',fatura:'F-100',parcela:'1/1',situacaoFatura:'Aberto',dataVencimento:'2026-10-30',
  valor:900,valorPagamento:null,valorResidual:900,valorTotal:900},
 {empresa:'CRC COSTA',fatura:'',parcela:'1/1',situacaoFatura:'Aberto',valor:50,valorPagamento:0,valorResidual:50,valorTotal:50}
]});
const state={recvRows:rows,recvSource:'live',recvRef:'E',recvCompany:'CRC COSTA',
 from:'2026-10-01',to:'2026-10-21',mode:'live'};
const veryLargeOrders={pedidos:[{numeroFatura:'OUTRA',valor:300000000,empresa:'CRC COSTA'}],viagens:[],ctes:[]};
test('Fatura parcelada conta uma vez, mas valores de parcelas são contabilizados corretamente',()=>{
 const m=invoiceSummary(rows,{today:'2026-10-21'});
 assert.equal(m.invoices,3);
 assert.equal(m.installments,5);
 assert.equal(m.invoicesWithoutNumber,1);
 assert.equal(m.face,1450);
 assert.equal(m.paid,400);
 assert.equal(m.residual,1050);
 assert.equal(m.invoicesWithConfirmedBalance,2);
 assert.equal(m.invoicesOverdue,1);
 const crc=invoiceSummary(rows.filter(x=>x.empresa==='CRC COSTA'),{today:'2026-10-21'});
 assert.equal(crc.invoices,2);
 assert.equal(crc.face,550);
 assert.equal(crc.paid,400);
 assert.equal(crc.residual,150);
 assert.equal(crc.paidInvoices,1);
});
test('Empresa distingue faturas iguais de empresas diferentes, sem usar número do pedido',()=>{
 const dist=invoiceDistributionByCompany(rows);
 assert.equal(dist.find(x=>x.name==='CRC COSTA').count,2);
 assert.equal(dist.find(x=>x.name==='IDEALLOG').count,1);
 const cards=renderCompanyFilter(rows,{...state,view:'painel'},veryLargeOrders);
 assert(cards.includes('<strong>2</strong><small>faturas</small>'));
 assert(cards.includes('<strong>2</strong><small>faturas</small>'));
 assert(!cards.includes('<strong>300.000.000</strong>'));
});
test('Nenhum total do Resumo de Faturas pode vir de pedido de frete, mesmo com valores grandes',()=>{
 const html=renderFinanceDashboard(veryLargeOrders,state);
 assert(html.includes('RESUMO DE FATURAS'));
 assert(html.includes('FATURAS IDENTIFICADAS'));
 assert(html.includes('PARCELAS REGISTRADAS'));
 assert(html.includes('VALOR DAS PARCELAS COM FATURA'));
 assert(html.includes('RECEBIDO EM FATURAS IDENTIFICADAS'));
 assert(html.includes('SALDO DE FATURAS IDENTIFICADAS'));
 assert(html.includes('550,00'));
 assert(html.includes('400,00'));
 assert(html.includes('150,00'));
 assert(!html.includes('300.000.000'));
 assert(!html.includes('FRETES INFORMADOS'));
 assert(!html.includes('LIBERADOS PARA FATURAR'));
 assert(!html.includes('PEDIDOS DE FRETE</div>'));
});
test('Ausência da API financeira não ativa fallback para valores de pedidos',()=>{
 for(const recvSource of ['pending','unavailable','demo']){
  const html=renderFinanceDashboard(veryLargeOrders,{...state,recvSource});
  assert(html.includes('Aguardando dados financeiros'));
  assert(!html.includes('550,00'));
  assert(!html.includes('300.000.000'));
  assert(html.includes('—'));
 }
});
test('Valores ausentes não viram zero: cobertura é exibida',()=>{
 const empty=renderFinanceDashboard(veryLargeOrders,{...state,recvRows:normalizeReceivables({status:200,registros:[
  {empresa:'CRC COSTA',fatura:'F-900',valor:null,valorPagamento:null,valorResidual:null}
 ]})});
 assert(empty.includes('FATURAS IDENTIFICADAS'));
 assert(empty.includes('Dados ausentes não foram estimados'));
 assert(!empty.includes('R$ 0,00'));
});
test('Referência P informa apenas parcelas pagas e não representa saldo completo',()=>{
 const html=renderFinanceDashboard(veryLargeOrders,{...state,recvRef:'P'});
 assert(html.includes('Somente parcelas pagas no período'));
});
test('A lista de arquivos estáticos serve o resumo financeiro no Render e no GitHub Pages',()=>{
 assert(readFileSync('api/server.mjs','utf8').includes("'invoice-summary.mjs'"));
 assert(readFileSync('.github/workflows/pages.yml','utf8').includes('src/invoice-summary.mjs'));
});

test('Confere valorTotal uma vez por fatura sem duplicar parcelas',()=>{
 const data=normalizeReceivables({status:200,registros:[
  {empresa:'CRC COSTA',fatura:'ABC',parcela:'1/2',valor:80,valorTotal:200,valorResidual:50},
  {empresa:'CRC COSTA',fatura:'ABC',parcela:'2/2',valor:120,valorTotal:200,valorResidual:null},
  {empresa:'IDEALLOG',fatura:'ABC',parcela:'1/1',valor:50,valorTotal:55,valorResidual:55}
 ]});
 const s=invoiceSummary(data);
 assert.equal(s.face,250);
 assert.equal(s.totalAudit.reportedTotalRows,455,'Soma ingênua duplicaria a fatura ABC da CRC');
 assert.equal(s.totalAudit.reportedTotalByInvoice,255,'Somar 200 CRC uma vez e 55 IDEALLOG');
 assert.equal(s.totalAudit.reportedTotalInvoicesKnown,2);
 assert.equal(s.totalAudit.reportedTotalInvoicesNotCounted,0);
 assert.equal(s.residualKnown,2);
 assert.equal(s.residual,105);
 const html=renderFinanceDashboard([],{
  ...state,recvRows:data,recvCompany:'all',recvSource:'live'
 });
 assert(html.includes('Conferência dos totais com o relatório DSS'));
 assert(html.includes('255,00'));
 assert(html.includes('2 de 3 parcelas com saldo informado'));
 assert(html.includes('Exportar dados (CSV)'));
});
test('Inconsistência em valorTotal deve ser sinalizada e não contada arbitrariamente',()=>{
 const data=normalizeReceivables({status:200,registros:[
  {empresa:'CRC COSTA',fatura:'AAA',parcela:'1/2',valor:10,valorTotal:30},
  {empresa:'CRC COSTA',fatura:'AAA',parcela:'2/2',valor:20,valorTotal:35},
  {empresa:'CRC COSTA',fatura:'BBB',parcela:'1/2',valor:40,valorTotal:80},
  {empresa:'CRC COSTA',fatura:'BBB',parcela:'2/2',valor:40,valorTotal:null},
  {empresa:'CRC COSTA',fatura:'CCC',parcela:'1/1',valor:60,valorTotal:null},
  {empresa:'CRC COSTA',fatura:'',parcela:'1/1',valor:5,valorTotal:5}
 ]});
 const m=invoiceSummary(data);
 assert.equal(m.totalAudit.reportedTotalInvoicesKnown,0);
 assert.equal(m.totalAudit.reportedTotalInvoicesConflicting,1);
 assert.equal(m.totalAudit.reportedTotalInvoicesPartiallyFilled,1);
 assert.equal(m.totalAudit.reportedTotalInvoicesMissing,1);
 assert.equal(m.totalAudit.reportedTotalWithoutInvoice,1);
 assert.equal(m.totalAudit.reportedTotalInvoicesNotCounted,3);
 assert.equal(m.invoicesWithoutNumber,1);
});

test('Totais financeiros de faturas identificadas não incluem lançamentos sem fatura',()=>{
 const m=invoiceSummary(rows,{today:'2026-10-21'});
 assert.equal(m.referenceAudit.identified.count,4);
 assert.equal(m.referenceAudit.unidentified.count,1);
 assert.equal(m.referenceAudit.identified.face,1400);
 assert.equal(m.referenceAudit.unidentified.face,50);
 assert.equal(m.referenceAudit.identified.residual,1000);
 assert.equal(m.referenceAudit.unidentified.residual,50);
 assert.equal(m.referenceAudit.identified.paid,400);
 const html=renderFinanceDashboard(veryLargeOrders,state);
 assert(html.includes('VALOR DAS PARCELAS COM FATURA'));
 assert(html.includes('SALDO DE FATURAS IDENTIFICADAS'));
 assert(html.includes('400,00'));
 assert(html.includes('500,00'));
 assert(html.includes('100,00'));
 assert(html.includes('Lançamentos sem número de fatura:'));
 assert(html.includes('Separadas dos totais de faturas'));
});
test('Comparação de três empresas mantém COMEX separada sem apagar dados',()=>{
 const three=normalizeReceivables({status:200,registros:[
 {empresa:'A.C DA COSTA DELIBERALI',fatura:'A',parcela:'1/1',valor:100,valorResidual:100},
 {empresa:'COMEX COSTA LOG',fatura:'B',parcela:'1/1',valor:200,valorResidual:200},
 {empresa:'CRC COSTA',fatura:'C',parcela:'1/1',valor:300,valorResidual:300},
 {empresa:'IDEALLOG',fatura:'D',parcela:'1/1',valor:400,valorResidual:400}
 ]});
 const c=invoicePerimeterComparison(three);
 assert.equal(c.all.invoices,4);
 assert.equal(c.withoutComex.invoices,3);
 assert.equal(c.all.referenceAudit.identified.face,1000);
 assert.equal(c.withoutComex.referenceAudit.identified.face,800);
 assert.equal(c.withoutComex.referenceAudit.identified.residual,800);
 const html=renderFinanceDashboard([], {...state,recvRows:three,recvCompany:'all'});
 assert(!html.includes('Comparar empresas incluídas no relatório'));
 assert(!html.includes('Hipótese a conferir'));
 assert(html.includes('3 faturas'));
 assert(!html.includes('4 faturas'));
});
