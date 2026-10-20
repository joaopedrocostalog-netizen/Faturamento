import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeReceivables,receivablesSummary,isOpenStatus,isPaidStatus} from '../src/receivables.mjs';
import {renderReceivables,filteredReceivables} from '../src/receivables-ui.mjs';
const state={from:'2026-01-01',to:'2026-10-20',recvRef:'E',recvSource:'live',recvPage:1};
test('Campos alternativos camel, Pascal e snake são normalizados sem trocar zero verdadeiro',()=>{
 const rows=normalizeReceivables({status:200,registros:[
  {Parceiro:'CLIENTE A',TIPO_FATURA:'FRETE',VALOR_PARCELA:'1.250,50',valor_pago:'0',saldo_devedor:'900,50',
   situacao_fatura:'Aberto',data_emissao:'01/10/2026',data_vencimento:'10/10/2026'},
  {PARCEIRO:'CLIENTE B',descricaoTipoFatura:'ARMAZENAGEM',valorNominalParcela:2000,
   valorRecebido:2000,saldoResidual:0,situacaoFatura:'Pago',dataPagamento:'15/10/2026'}
 ]});
 assert.equal(rows[0].tipoFatura,'FRETE');
 assert.equal(rows[0].valor,1250.5);
 assert.equal(rows[0].valorPagamento,0);
 assert.equal(rows[0].valorResidual,900.5);
 assert.equal(rows[0].situacaoFatura,'Aberto');
 assert.equal(rows[1].tipoFatura,'ARMAZENAGEM');
 assert.equal(rows[1].valor,2000);
 assert.equal(rows[1].valorPagamento,2000);
 assert.equal(rows[1].valorResidual,0);
 assert.equal(rows[1].dataPagamento,'2026-10-15');
 const sum=receivablesSummary(rows,{today:'2026-10-20'});
 assert.equal(sum.paid,2000);
 assert.equal(sum.residual,900.5);
 assert.equal(sum.lateCount,1);
 assert.equal(sum.missingTypes,0);
});
test('403 parcelas com campos zeros e sem tipo não viram pagamento inventado',()=>{
 const raw=Array.from({length:403},(_,i)=>({
  parceiro:'CLIENTE '+(i%9),situacaoFatura:i<343?'Pago':i<388?'':'Aberto',
  dataEmissao:'01/10/2026',dataVencimento:'10/10/2026',
  valor:100+i,valorPagamento:0,valorResidual:0,tipoFatura:''
 }));
 const rows=normalizeReceivables({status:200,registros:raw});
 const sum=receivablesSummary(rows,{today:'2026-10-20'});
 assert.equal(sum.count,403);
 assert.equal(sum.paid,0);
 assert.equal(sum.residual,0);
 assert.equal(sum.paidWithoutAmount,343);
 assert.equal(sum.openWithZeroResidual,15);
 assert.equal(sum.missingTypes,403);
 assert.equal(sum.lateCount,0); // Não estimar saldo residual a partir do status "Aberto"
 assert(sum.inferredPaidNominal>0); // Indicador nominal identificado, NÃO valor recebido.
 const html=renderReceivables(rows,state);
 assert(html.includes('PAGAS SEM VALOR CONFIRMADO'));
 assert(html.includes('343 parcela(s) classificadas como pagas'));
 assert(html.includes('15 parcela(s) classificadas como abertas'));
 assert(html.includes('Valor NOMINAL por parceiro'));
 assert(html.includes('Quantidade por situação da fatura'));
 assert(html.includes('Parcelas por centro de custo'));
 assert(html.includes('VENCIMENTOS E FAIXAS DE ATRASO'));
 assert(!html.includes('Pagamento confirmado: '+sum.inferredPaidNominal));
 assert.equal((html.match(/<tr>/g)||[]).length,26+6+1); // 25 visíveis + 6 faixas, com cabeçalhos
 assert.equal(filteredReceivables(rows,state).length,403);
});
test('Se nenhum valor monetário veio na API, mostrar contagens e não gráficos zerados',()=>{
 const rows=normalizeReceivables({status:200,registros:[{dataEmissao:'2026-10-01',parceiro:'ACME',situacaoFatura:'Aberto',valor:0,valorResidual:0,valorPagamento:0}]});
 const html=renderReceivables(rows,state);
 assert(html.includes('Quantidade de parcelas por parceiro'));
 assert(html.includes('Quantidade de parcelas por mês de vencimento'));
 assert(html.includes('Não informado pelo DSS'));
});
test('Faixas de atraso respeitam vencimentos e não incluem saldo de parcelas quitadas',()=>{
 const dates=['2026-10-21','2026-10-19','2026-09-10','2026-08-01','2026-06-01',''];
 const rows=normalizeReceivables({status:200,registros:dates.map((day,i)=>({
  parceiro:'Empresa '+i,valor:100,valorResidual:i===0?0:50,valorPagamento:i===0?100:0,
  dataVencimento:day,situacaoFatura:i===0?'Pago':'Aberto'
 }))});
 const s=receivablesSummary(rows,{today:'2026-10-20'});
 assert.deepEqual(s.aging.map(g=>g.count),[1,1,1,1,1,1]);
 assert.equal(s.lateCount,4);
 assert.equal(s.lateResidual,200);
 assert.equal(s.aging[0].value,0);
 assert.equal(s.aging[1].value,50);
 assert.equal(s.aging[5].count,1);
 assert(isPaidStatus('PAGO'));assert(isOpenStatus('Em aberto'));
});
test('Grupos não inferem tipo de fatura a partir de centros de custo ou método de pagamento',()=>{
 const rows=normalizeReceivables({status:200,registros:[
  {valor:300,valorResidual:200,tipoFatura:'',centroCusto:'Terminal',metodoPagamento:'PIX'},
  {valor:150,valorResidual:150,tipoFatura:'Transporte',centroCusto:'Frota'}
 ]});
 const s=receivablesSummary(rows,{today:'2026-10-20'});
 assert.equal(s.missingTypes,1);
 assert(s.tipos.some(x=>x.name==='Não informado pelo DSS'&&x.count===1));
 assert(s.centros.some(x=>x.name==='Terminal'));
 const h=renderReceivables(rows,{recvRef:'E',recvSource:'live',from:'2026-01-01',to:'2026-10-20'});
 assert(h.includes('Parcelas por tipo de fatura informado'));
 assert(h.includes('TIPO DE FATURA AUSENTE'));
});
