import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {permittedView,reportTypesFor,safeView,secureReport,SHOW_FINANCE_ONLY_TABS,FIN_VIEWS,HIDDEN_FINANCE_VIEWS} from '../src/access-ui.mjs';
import {renderFinanceDashboard,renderFinanceComparison} from '../src/financial-ui.mjs';
const empty={viagens:[],pedidos:[],ctes:[],mdfes:[],sources:{}};
const state={from:'2026-01-01',to:'2026-10-19',mode:'demo',dataset:empty,compareCurrentFrom:'2026-01-01',compareCurrentTo:'2026-01-31',comparePreviousFrom:'2026-02-01',comparePreviousTo:'2026-02-28',hiddenColumns:{},page:1,permissions:{financeiro:true}};
test('Somente financeiros e administradores acessam',()=>{
 for(const role of ['financeiro','administrador'])for(const view of ['painel','faturamento','ctes','clientes','comparativos'])assert(permittedView(role,view));
 assert.equal(SHOW_FINANCE_ONLY_TABS,false);
 assert.deepEqual(HIDDEN_FINANCE_VIEWS,['analises','relatorios']);
 for(const role of ['financeiro','administrador'])for(const view of HIDDEN_FINANCE_VIEWS)assert(!permittedView(role,view));
 for(const view of HIDDEN_FINANCE_VIEWS)assert(FIN_VIEWS.includes(view),'Manter implementação para reutilização');
 for(const role of ['operacional','','visitante'])for(const view of ['painel','faturamento','ctes','relatorios'])assert(!permittedView(role,view));
 for(const role of ['financeiro','administrador','operacional'])for(const view of ['viagens','veiculos','motoristas','rotas','mdfes','administracao'])assert(!permittedView(role,view));
 assert.equal(safeView('operacional','faturamento'),'acesso');
 assert.equal(safeView('financeiro','viagens'),'painel');
 assert.equal(safeView('financeiro','relatorios'),'painel');
 assert.equal(safeView('financeiro','analises'),'painel');
 assert.deepEqual(reportTypesFor('financeiro'),['pedidos','ctes','clientes']);
 assert.deepEqual(reportTypesFor('operacional'),[]);
 assert.throws(()=>secureReport({columns:[],rows:[]},'pedidos','operacional'),/não permitido/);
});
test('Resumo e comparativo exibem dados financeiros, sem indicadores de frota',()=>{
 const home=renderFinanceDashboard(empty,state),comparison=renderFinanceComparison(empty,state);
 for(const phrase of ['RESUMO DE FATURAS','FATURAS IDENTIFICADAS','SALDO A RECEBER'])assert(home.includes(phrase));
 assert(comparison.includes('COMPARATIVO DE FATURAMENTO'));
 assert(!home.includes('data-nav="relatorios"'));
 assert(!home.includes('EXPORTAR RELATÓRIOS'));
 assert(!home.includes('ANÁLISES FINANCEIRAS'));
 assert(!home.includes('data-ins-action="customize"'));
 assert(!home.includes('ins-dashboard-customizer'));
 assert(!home.includes('ins-analytics-chart'));
 assert(!home.includes('ins-chart'));
 assert(!home.includes('ins-dashboard'));
 assert(!home.includes('ins-analytics'));
 assert(!home.includes('ins-graphs'));
 assert(!home.includes('Análise por Cliente'));
 assert(!home.includes('ANÁLISE FINANCEIRA'));
 assert(!home.includes('ANÁLISE DE FATURAMENTO'));
 assert(comparison.includes('CONSULTAR COMPARATIVO NO DSS'));
 assert(comparison.includes('id="compareCurrentFrom"'));
 assert(comparison.includes('id="comparePreviousFrom"'));
 assert(!comparison.includes('Fretes informados</td>'),'Não presumir dados de demonstração sem consulta DSS');
 const actual={...state,mode:'live',comparison:{
  currentRange:{from:state.compareCurrentFrom,to:state.compareCurrentTo},
  previousRange:{from:state.comparePreviousFrom,to:state.comparePreviousTo},
  current:empty,previous:empty,source:'DSS'
 }};
 const withData=renderFinanceComparison(empty,actual);
 assert(withData.includes('Fretes informados'));
 assert(withData.includes('Liberados sem nº de fatura'));
 assert(!home.includes('VER TODAS AS VIAGENS'));
});
test('A navegação do frontend é financeira',()=>{
 const s=readFileSync('src/app.js','utf8');
 const nav=s.split('\n').find(x=>x.startsWith('const navItems='));
 assert(nav.includes("['faturamento'"));
 assert(nav.includes("['painel','home','Painel']"));
 assert(nav.includes("['analises'"),'Código da aba de análises deve permanecer');
 assert(nav.includes("['relatorios'"),'Código da aba de relatórios deve permanecer');
 for(const view of ['veiculos','motoristas','rotas','viagens','mdfes','administracao','integracoes'])assert(!nav.includes("['"+view+"'"));
 assert(s.includes('GESTÃO DE FATURAMENTO'));
 assert(s.includes('logo-costalog-sem-fundo-1024x876.png'));
});