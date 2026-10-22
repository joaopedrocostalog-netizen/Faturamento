import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
import {BRANDS,brandConfig,brandCompanies,validSelectedCompany,scopeReceivables,scopeOverview,scopeDocuments} from '../src/brands.mjs';
import {renderCompanyFilter} from '../src/receivables-ui.mjs';
import {renderFinanceDashboard,renderFinanceComparison} from '../src/financial-ui.mjs';
import {normalizeReceivables} from '../src/receivables.mjs';
import {receivablesReport} from '../src/receivables-report.mjs';

const rows=normalizeReceivables({status:200,registros:[
 {empresa:'A.C DA COSTA DELIBERALI',fatura:'F-1',parceiro:'Cliente A',valor:100,valorResidual:100},
 {empresa:'COMEX COSTA LOG',fatura:'F-2',parceiro:'Cliente B',valor:200,valorResidual:100},
 {empresa:'CRC COSTA',fatura:'F-3',parceiro:'Cliente C',valor:300,valorResidual:200},
 {empresa:'IDEALLOG',fatura:'F-4',parceiro:'Cliente D',valor:400,valorResidual:300},
 {empresa:'EMPRESA SEM MAPEAMENTO',fatura:'F-5',parceiro:'Cliente E',valor:500,valorResidual:400},
 {empresa:null,fatura:'F-6',parceiro:'Cliente F',valor:600,valorResidual:500}
]});
const overview={viagens:[
 {id:1,empresa:'CRC COSTA'},{id:2,empresa:'IDEALLOG'},{id:3,empresa:''}],
 pedidos:[
 {id:11,empresa:'CRC COSTA',numeroFatura:'F-3',numeroNfse:'N-3',valor:300},
 {id:12,empresa:'IDEALLOG',numeroFatura:'F-4',numeroNfse:'N-4',valor:400},
 {id:13,empresa:'',numeroFatura:'F-6',numeroNfse:'N-6',valor:600}
 ],ctes:[{id:21,empresa:'CRC COSTA'},{id:22,empresa:'IDEALLOG'}],
 mdfes:[{id:'m1'}],ocorrencias:[{id:'o1'}],sources:{viagens:true,pedidos:true,ctes:true,mdfes:true}};
const documents=[
 {id:'a',fatura:'F-3',numeroNfse:'N-3',parceiro:'Cliente C'},
 {id:'b',fatura:'F-4',numeroNfse:'N-4',parceiro:'Cliente D'},
 {id:'c',fatura:'F-6',numeroNfse:'N-6',parceiro:'Cliente F'},
 {id:'d',fatura:'F-3',numeroNfse:'N-4',parceiro:'Cliente A'},
 {id:'e',parceiro:'CRC COSTA',numeroNfse:'N-UNKNOWN'}
];

test('Ambientes têm listas disjuntas, nomes e logos distintos',()=>{
 assert.deepEqual(brandCompanies('costalog'),['A.C DA COSTA DELIBERALI','COMEX COSTA LOG','CRC COSTA']);
 assert.deepEqual(brandCompanies('ideallog'),['IDEALLOG']);
 assert.notEqual(brandConfig('costalog').logo,brandConfig('ideallog').logo);
 assert.equal(validSelectedCompany('ideallog','CRC COSTA'),'all');
 assert.equal(validSelectedCompany('costalog','IDEALLOG'),'all');
 assert(!brandCompanies('ideallog').some(x=>brandCompanies('costalog').includes(x)));
});

test('API de parcelas: COSTALOG só 3 empresas, IDEALLOG apenas uma, desconhecidos excluídos',()=>{
 const costa=scopeReceivables(rows,'costalog'),ideal=scopeReceivables(rows,'ideallog');
 assert.deepEqual(costa.map(x=>x.fatura),['F-1','F-2','F-3']);
 assert.deepEqual(ideal.map(x=>x.fatura),['F-4']);
 assert.equal(costa.reduce((x,r)=>x+r.valor,0),600);
 assert.equal(ideal.reduce((x,r)=>x+r.valor,0),400);
 assert.equal(scopeReceivables(rows,'costalog','CRC COSTA').length,1);
 assert.deepEqual(scopeReceivables(rows,'ideallog','CRC COSTA'),ideal,'Seleção inválida não vaza outra marca');
 assert.strictEqual(scopeReceivables(rows,'costalog'),costa,'Mudanças de aba reutilizam filtro em cache');
});
test('Pedidos e viagens permanecem separados; itens sem empresa não entram em qualquer ambiente',()=>{
 const costa=scopeOverview(overview,'costalog'),ideal=scopeOverview(overview,'ideallog');
 assert.equal(costa.pedidos.length,1);assert.equal(costa.pedidos[0].id,11);
 assert.equal(ideal.pedidos.length,1);assert.equal(ideal.pedidos[0].id,12);
 assert.equal(costa.ctes.length,1);assert.equal(ideal.ctes.length,1);
 assert.equal(costa.viagens.length,1);assert.equal(ideal.viagens.length,1);
 assert.equal(costa.mdfes.length,0);assert.equal(ideal.ocorrencias.length,0);
});
test('NFS-e vinculadas ambiguamente, sem vínculo ou de outra empresa nunca são expostas',()=>{
 const costa=scopeDocuments(documents,overview,rows,'costalog'),
  ideal=scopeDocuments(documents,overview,rows,'ideallog');
 assert.deepEqual(costa.rows.map(x=>x.id),['a']);
 assert.deepEqual(ideal.rows.map(x=>x.id),['b']);
 assert.equal(costa.unassigned,3);
 assert.equal(ideal.unassigned,3);
 const crc=scopeDocuments(documents,overview,rows,'costalog','CRC COSTA');
 assert.deepEqual(crc.rows.map(x=>x.id),['a']);
});
test('Painel e seletores não incluem valores de outras empresas ou Outras / não identificadas',()=>{
 const base={mode:'live',brand:'costalog',view:'painel',recvSource:'live',recvRef:'E',
  recvRows:scopeReceivables(rows,'costalog'),recvCompany:'all',from:'2026-10-01',to:'2026-10-21'};
 const costa=renderFinanceDashboard(scopeOverview(overview,'costalog'),base);
 assert(costa.includes('600,00'));assert(!costa.includes('900,00'));
 const ideal=renderFinanceDashboard(scopeOverview(overview,'ideallog'),{...base,brand:'ideallog',recvRows:scopeReceivables(rows,'ideallog')});
 assert(ideal.includes('400,00'));assert(!ideal.includes('600,00'));
 const selectorC=renderCompanyFilter(rows,{...base,brand:'costalog',view:'painel'},overview);
 assert(selectorC.includes('COMEX COSTA LOG'));
 assert(!selectorC.includes('IDEALLOG'));
 assert(!selectorC.includes('Outras / não identificadas'));
 assert(selectorC.includes('<strong>3</strong><small>faturas</small>'));
 const selectorI=renderCompanyFilter(rows,{...base,brand:'ideallog',view:'painel'},overview);
 assert(selectorI.includes('IDEALLOG'));
 assert(!selectorI.includes('CRC COSTA'));
 assert(!selectorI.includes('Outras / não identificadas'));
 assert(!selectorI.includes('data-company-select="all"'),'Marca única não requer cartão redundante');
});
test('Relatórios exportam apenas parcelas da marca; comparativos separam períodos',()=>{
 const state={recvCompany:'all',recvRef:'E',from:'2026-10-01',to:'2026-10-21'};
 const costa=receivablesReport(scopeReceivables(rows,'costalog'),state);
 const ideal=receivablesReport(scopeReceivables(rows,'ideallog'),state);
 assert.equal(costa.count,3);assert.equal(ideal.count,1);
 assert(!costa.rows.some(x=>x.empresa==='IDEALLOG'));
 assert(!ideal.rows.some(x=>x.empresa==='CRC COSTA'));
 const source=readFileSync('src/financial-ui.mjs','utf8');
 assert(source.includes("scopeOverview(c.current,state.brand)"));
 assert(source.includes("scopeOverview(c.previous,state.brand)"));
});
test('Assets e backend tornam Ideallog.png disponível em Render e GitHub Pages',()=>{
 const logo=statSync('Ideallog.png');
 assert(logo.size>1000);
 const backend=readFileSync('api/server.mjs','utf8');
 assert(backend.includes("['/Ideallog.png','Ideallog.png']"));
 assert(backend.includes("'brands.mjs'"));
 const dockerfile=readFileSync('Dockerfile','utf8');
 assert.match(dockerfile,/COPY[^\n]*\bIdeallog\.png\s+\.\//,'Render deve copiar a logo da IDEALLOG para a pasta do site');
 const workflow=readFileSync('.github/workflows/pages.yml','utf8');
 assert(workflow.includes('Ideallog.png public_site/'));
 assert(workflow.includes('src/brands.mjs'));
});
