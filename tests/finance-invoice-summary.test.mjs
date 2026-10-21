import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {invoiceSummary,invoiceDistributionByCompany} from '../src/invoice-summary.mjs';
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
 assert(cards.includes('<strong>3</strong><small>faturas</small>'));
 assert(cards.includes('<strong>2</strong><small>faturas</small>'));
 assert(!cards.includes('<strong>300.000.000</strong>'));
});
test('Nenhum total do Resumo de Faturas pode vir de pedido de frete, mesmo com valores grandes',()=>{
 const html=renderFinanceDashboard(veryLargeOrders,state);
 assert(html.includes('RESUMO DE FATURAS'));
 assert(html.includes('FATURAS IDENTIFICADAS'));
 assert(html.includes('PARCELAS REGISTRADAS'));
 assert(html.includes('VALOR DAS PARCELAS'));
 assert(html.includes('VALOR RECEBIDO INFORMADO'));
 assert(html.includes('SALDO A RECEBER'));
 assert(html.includes('R$ 550,00'));
 assert(html.includes('R$ 400,00'));
 assert(html.includes('R$ 150,00'));
 assert(!html.includes('300.000.000'));
 assert(!html.includes('FRETES INFORMADOS'));
 assert(!html.includes('LIBERADOS PARA FATURAR'));
 assert(!html.includes('PEDIDOS DE FRETE</div>'));
});
test('Ausência da API financeira não ativa fallback para valores de pedidos',()=>{
 for(const recvSource of ['pending','unavailable','demo']){
  const html=renderFinanceDashboard(veryLargeOrders,{...state,recvSource});
  assert(html.includes('Aguardando dados financeiros'));
  assert(!html.includes('R$ 550,00'));
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
