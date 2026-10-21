import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildInsights,makeAlerts,sortRecords,searchRecords} from '../src/operational.mjs';
import {renderGrid} from '../src/advanced-ui.mjs';
import {customerProfiles} from '../src/intelligence.mjs';
import {renderCustomerProfiles} from '../src/intelligence-ui.mjs';
import {filteredElectronicDocuments,renderElectronicDocuments} from '../src/e-documents-ui.mjs';

const pedidos=Array.from({length:3000},(_,i)=>({
 id:'p'+i,numero:String(10000+i),pedidoNumero:String(10000+i),
 data:'2026-06-01',cliente:'Empresa '+String(i%70).padStart(2,'0'),
 placa:'ABC-1234',valor:i*2,valorReceber:i*2,viagemId:'rv'+i,
 isCte:true,status:'Emitido',cteNumero:String(5000+i),numeroFatura:'F-'+i
}));
const viagens=Array.from({length:3000},(_,i)=>({
 id:'rv'+i,numero:String(i),data:'2026-06-01',cliente:'Empresa '+String(i%70).padStart(2,'0'),
 placa:'ABC-1234',kmRodados:50,kmPrevisto:55,status:'Concluído'
}));
const data={pedidos,viagens,ctes:[],mdfes:[],sources:{pedidos:true,viagens:true,ctes:true,mdfes:false}};
test('Indicadores anuais e alertas reutilizam o mesmo cálculo, sem busca quadrática por RV',()=>{
 const a=buildInsights(data,{year:2026}),b=buildInsights(data,{year:2026});
 assert.strictEqual(a,b,'Navegar na tabela não deve recalcular os indicadores');
 assert.equal(a.totals.orders,3000);
 assert.equal(makeAlerts(data).filter(x=>x.type==='rv_sem_pedido').length,0);
});
test('Ordenação e pesquisa de um ano só se repetem quando mudam os filtros',()=>{
 const first=sortRecords(pedidos,'valorReceber','desc');
 assert.strictEqual(sortRecords(pedidos,'valorReceber','desc'),first);
 assert.equal(first[0].valorReceber,5998);
 const filtered=searchRecords(pedidos,'Empresa 01');
 assert.strictEqual(searchRecords(pedidos,'Empresa 01'),filtered);
 assert(filtered.length>1);
});
test('Tabela Faturamento monta apenas as 25 linhas visíveis, mantendo a ordenação geral',()=>{
 const columns=[{key:'pedidoNumero',label:'Pedido'},{key:'valorReceber',label:'Valor a receber',format:'money'}];
 const state={sortDir:'desc',sortKey:'',page:1,hiddenColumns:{}};
 const page1=renderGrid('Faturamento',pedidos,columns,state,'faturamento');
 assert.equal((page1.match(/<tr>/g)||[]).length,26);
 assert(page1.includes('10000')===false);
 assert(page1.includes(String(10000+2999)));
 const page2=renderGrid('Faturamento',pedidos,columns,{...state,page:2},'faturamento');
 assert.equal((page2.match(/<tr>/g)||[]).length,26);
 assert(!page2.includes(String(10000+2999)));
});
test('Clientes exibem 25 nomes por página e não 70 de uma vez',()=>{
 const profiles=customerProfiles(data,{financial:true});
 assert.equal(profiles.length,70);
 assert.strictEqual(customerProfiles(data,{financial:true}),profiles);
 const state={permissions:{financeiro:true},page:1,search:'',tableSort:{},clientSelected:null};
 const html=renderCustomerProfiles(data,state);
 assert.equal((html.match(/<tbody>/g)||[]).length,1);
 assert.equal((html.match(/<tr>/g)||[]).length,26);
 assert(html.includes('70 clientes'));
 const html2=renderCustomerProfiles(data,{...state,page:2});
 assert.equal((html2.match(/<tr>/g)||[]).length,26);
 assert.notEqual(html,html2);
});
test('Perfil de um cliente monta até 25 pedidos e 25 viagens em cada página',()=>{
 const state={permissions:{financeiro:true},page:1,search:'',tableSort:{},clientSelected:'Empresa 01',clientDetailPage:1};
 const html=renderCustomerProfiles(data,state);
 assert(html.includes('PERFIL DO CLIENTE'));
 assert(html.includes('data-action="customer-detail-next"'));
 assert((html.match(/data-profile-detail="ctes:/g)||[]).length<=25);
 assert((html.match(/data-profile-detail="viagens:/g)||[]).length<=25);
});
test('NFS-e reutiliza filtros/ordenação entre páginas, sem montar os outros registros',()=>{
 const docs=Array.from({length:250},(_,i)=>({
 id:String(i),numeroNfse:'NF'+i,parceiro:'Empresa Exemplo',
 tipoOperacao:'Serviços',status:'Emitida',modelo:'NFS-e',
 dataEmissao:'2026-09-01',valorFinal:i*10,totalIss:i
 }));
 const s={from:'2026-01-01',to:'2026-10-20',search:'',docsSortKey:'valorFinal',docsSortDir:'desc',docsPage:1};
 const first=filteredElectronicDocuments(docs,s);
 assert.strictEqual(filteredElectronicDocuments(docs,{...s,docsPage:2}),first);
 const html=renderElectronicDocuments(docs,s);
 assert.equal((html.match(/<tbody>/g)||[]).length,1);
 assert.equal((html.match(/<tr>/g)||[]).length,26);
 assert(html.includes('NF249'));
 assert(!html.includes('NF0</td>'));
});
test('Filtros avançados somente são construídos quando expandidos',()=>{
 const app=readFileSync('src/app.js','utf8');
 assert(app.includes("(state.extraFiltersOpen?operationalFilters(overviewByCompany(state.dataset,state.recvCompany||'all'),state):'')"));
 assert(app.includes("state.extraFiltersOpen=!state.extraFiltersOpen"));
 assert(app.includes("const d=scoped(),stats=['viagens','mdfes'].includes(state.view)?totals(d):null"));
 assert(app.includes('clearTimeout(searchRenderTimer)'));
 assert(app.includes('setTimeout(()=>{searchRenderTimer=null;render()'));
 assert(!app.includes("state.syncProgress='DSS: '+done+'/'+windows.length+' períodos';render();"));
});
