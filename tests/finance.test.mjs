import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {permittedView,reportTypesFor,safeView,secureReport} from '../src/access-ui.mjs';
import {renderFinanceDashboard,renderFinanceComparison} from '../src/financial-ui.mjs';
const empty={viagens:[],pedidos:[],ctes:[],mdfes:[],sources:{}};
const state={from:'2026-01-01',to:'2026-10-19',mode:'demo',dataset:empty,compareCurrentFrom:'2026-01-01',compareCurrentTo:'2026-01-31',comparePreviousFrom:'2026-02-01',comparePreviousTo:'2026-02-28',hiddenColumns:{},page:1,permissions:{financeiro:true}};
test('Somente financeiros e administradores acessam',()=>{
 for(const role of ['financeiro','administrador'])for(const view of ['painel','faturamento','ctes','clientes','analises','comparativos','relatorios'])assert(permittedView(role,view));
 for(const role of ['operacional','','visitante'])for(const view of ['painel','faturamento','ctes','relatorios'])assert(!permittedView(role,view));
 for(const role of ['financeiro','administrador','operacional'])for(const view of ['viagens','veiculos','motoristas','rotas','mdfes','administracao'])assert(!permittedView(role,view));
 assert.equal(safeView('operacional','faturamento'),'acesso');
 assert.equal(safeView('financeiro','viagens'),'painel');
 assert.deepEqual(reportTypesFor('financeiro'),['pedidos','ctes','clientes']);
 assert.deepEqual(reportTypesFor('operacional'),[]);
 assert.throws(()=>secureReport({columns:[],rows:[]},'pedidos','operacional'),/não permitido/);
});
test('Resumo e comparativo exibem dados financeiros, sem indicadores de frota',()=>{
 const home=renderFinanceDashboard(empty,state),comparison=renderFinanceComparison(empty,state);
 for(const phrase of ['RESUMO FINANCEIRO','LIBERADOS SEM FATURA','TICKET MÉDIO'])assert(home.includes(phrase));
 assert(comparison.includes('COMPARATIVO FINANCEIRO'));
 assert(comparison.includes('Fretes informados'));
 assert(comparison.includes('Liberados sem nº de fatura'));
 assert(!home.includes('VER TODAS AS VIAGENS'));
});
test('A navegação do frontend é financeira',()=>{
 const s=readFileSync('src/app.js','utf8');
 const nav=s.split('\n').find(x=>x.startsWith('const navItems='));
 assert(nav.includes("['faturamento'"));
 for(const view of ['veiculos','motoristas','rotas','viagens','mdfes','administracao','integracoes'])assert(!nav.includes("['"+view+"'"));
 assert(s.includes('GESTÃO FINANCEIRA & FATURAMENTO'));
 assert(s.includes('logo-costalog-sem-fundo-1024x876.png'));
});