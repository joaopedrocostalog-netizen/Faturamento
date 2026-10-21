import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {reconcileFreightDocuments,filteredReconciliation} from '../src/reconciliation.mjs';
import {renderReconciliation} from '../src/reconciliation-ui.mjs';
const orders=[
 {id:'1',pedidoNumero:'PF-1',numeroFatura:'F/100',numeroNfse:'N-100',empresa:'CRC COSTA',cliente:'Cliente A',valor:1000,data:'2026-10-01'},
 {id:'2',pedidoNumero:'PF-2',numeroFatura:'F/200',numeroNfse:'',empresa:'COMEX COSTA LOG',cliente:'Cliente B',valor:2500,data:'2026-10-02'},
 {id:'3',pedidoNumero:'PF-3',numeroFatura:'',numeroNfse:'',empresa:'IDEALLOG',cliente:'Cliente C',valor:500,data:'2026-10-03'},
 {id:'4',pedidoNumero:'PF-4',numeroFatura:'F/NAO',numeroNfse:'',empresa:'CRC COSTA',cliente:'Cliente D',valor:550,data:'2026-10-03'}
];
const documents=[
 {id:'A',fatura:'F/100',numeroNfse:'N-100',parceiro:'Cliente A',valorFinal:1000},
 {id:'B',fatura:'F/200',numeroNfse:'N-200',parceiro:'Cliente B',valorFinal:2400}
];
test('Igualdade de referência liga documento sem deduzir emissão ou pagamento',()=>{
 const r=reconcileFreightDocuments(orders,documents,[],{docsSource:'live',recvSource:'pending'});
 assert.equal(r.entries[0].status,'vinculado');
 assert.equal(r.entries[0].method,'Número da fatura');
 assert.equal(r.entries[0].doc.id,'A');
 assert.equal(r.entries[1].status,'vinculado');
 assert.equal(r.entries[2].status,'sem_referencia');
 assert.equal(r.entries[3].status,'sem_correspondencia');
 assert.equal(r.summary.vinculado,2);
 assert.equal(r.summary.sem_correspondencia,1);
 assert.strictEqual(reconcileFreightDocuments(orders,documents,[],{docsSource:'live',recvSource:'pending'}).entries.length,4);
});
test('Sem notas sincronizadas nunca afirma que um documento está ausente',()=>{
 const r=reconcileFreightDocuments(orders,documents,[],{docsSource:'demo',recvSource:'demo'});
 assert.equal(r.summary.nao_consultado,4);
 assert.equal(r.summary.sem_correspondencia,0);
 const html=renderReconciliation(orders,documents,[],{docsSource:'demo',recvSource:'demo',recvCompany:'all'});
 assert(html.includes('ainda não foram conferidos'));
 assert(html.includes('Aguardando sincronização'));
});
test('Mesma referência usada em duas empresas diferentes exige conferência',()=>{
 const orders2=[orders[0],{...orders[0],id:'5',empresa:'COMEX COSTA LOG'}];
 const r=reconcileFreightDocuments(orders2,documents,[],{docsSource:'live'});
 assert.equal(r.summary.conferir,2);
 assert(r.entries.every(x=>!x.doc));
});
test('Fatura duplicada em notas, dados contraditórios e referências cruzadas exigem conferência',()=>{
 const docs=[...documents,{id:'C',fatura:'F/100',numeroNfse:'N-101'}];
 const r=reconcileFreightDocuments([{...orders[0],numeroNfse:''}],docs,[],{docsSource:'live'});
 assert.equal(r.summary.conferir,1);
 const opposite=reconcileFreightDocuments([{...orders[0],numeroNfse:'N-200'}],documents,[],{docsSource:'live'});
 assert.equal(opposite.summary.conferir,1);
 assert(!opposite.entries[0].doc);
 const mismatch=reconcileFreightDocuments([{...orders[0],numeroFatura:'F/ZZZ'}],documents,[],{docsSource:'live'});
 assert.equal(mismatch.summary.conferir,1);
});
test('Mesma fatura e empresa nas parcelas pode informar quantidade sem inferir recebimento',()=>{
 const rows=[
 {fatura:'F/100',empresa:'CRC COSTA',valorPagamento:300},
 {fatura:'F/100',empresa:'CRC COSTA',valorPagamento:0},
 {fatura:'F/100',empresa:'COMEX COSTA LOG',valorPagamento:999}
 ];
 const r=reconcileFreightDocuments(orders,documents,rows,{docsSource:'live',recvSource:'live'});
 assert.equal(r.entries[0].installments,2);
 assert.equal(r.entries[1].installments,0);
 assert.equal(r.entries[0].receivablesAvailable,true);
});
test('Empresa, situação, pesquisa e paginação não recalculam todos os pedidos ao navegar',()=>{
 const r=reconcileFreightDocuments(orders,documents,[],{docsSource:'live'});
 assert.equal(filteredReconciliation(r,{recvCompany:'CRC COSTA'}).length,2);
 assert.equal(filteredReconciliation(r,{reconStatus:'sem_referencia'}).length,1);
 assert.equal(filteredReconciliation(r,{reconSearch:'cliente b'}).length,1);
 const many=Array.from({length:130},(_,i)=>({...orders[0],id:'id-'+i,pedidoNumero:'PED-'+i,numeroFatura:'F/'+i,numeroNfse:''}));
 const html=renderReconciliation(many,[],[],{docsSource:'live',recvCompany:'all',reconPage:1});
 assert.equal((html.match(/<tbody>/g)||[]).length,1);
 assert.equal((html.match(/<tr>/g)||[]).length,26);
 assert(html.includes('Página 1 de 6'));
 assert(html.includes('data-action="recon-next"'));
 assert(!html.includes('PED-129</td>'));
});
test('Escapa HTML vindo do DSS e não mostra campos técnicos como identificadores do painel',()=>{
 const html=renderReconciliation([{...orders[0],cliente:'<img src=x onerror=alert(1)>'}],documents,[],
  {docsSource:'live',recvCompany:'all'});
 assert(!html.includes('<img src=x onerror'));
 assert(html.includes('&lt;img'));
 assert(!html.includes('valor_soma'));
});
test('Filtros por placa só na aba de CT-e e fonte da lista é dataset completo',()=>{
 const app=readFileSync('src/app.js','utf8'),filters=readFileSync('src/advanced-ui.mjs','utf8');
 const access=readFileSync('src/access-ui.mjs','utf8'),server=readFileSync('api/server.mjs','utf8');
 assert(filters.includes("s.view==='ctes'?filter('filterPlate'"));
 assert(app.includes("const byPlate=state.view==='ctes'?state.vehicle:'';"));
 assert(app.includes("overviewByCompany(state.dataset,state.recvCompany||'all')"));
 assert(app.includes('renderReconciliation(state.dataset.pedidos,state.docsRows,state.recvRows,state)'));
 assert(access.includes("'conciliacao'"));
 assert(server.includes("'reconciliation.mjs','reconciliation-ui.mjs'"));
 assert(app.includes("state.view==='integracoes'||state.view==='comparativos'"));
});
test('As rotas de pedidos/viagens já existem, sem ativar uma API de parceiros indevidamente',()=>{
 const backend=readFileSync('api/server.mjs','utf8');
 assert(backend.includes("'/listarViagens'")&&backend.includes("'/listarPedidosFrete'"));
 assert(backend.includes("'/listarRotas'")&&backend.includes("'/listarProgramacoes'"));
 assert(!backend.includes("DSS_PARCEIROS_PATH"));
});
