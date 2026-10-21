import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {COSTALOG_COMPANIES,COMPANY_UNIDENTIFIED,companyOfReceivable,companyDistribution,receivablesByCompany} from '../src/companies.mjs';
import {normalizeReceivables,receivablesSummary} from '../src/receivables.mjs';
import {renderCompanyFilter,renderReceivables} from '../src/receivables-ui.mjs';
import {renderFinanceDashboard} from '../src/financial-ui.mjs';
import {renderManagerialDashboard} from '../src/managerial-ui.mjs';
const data=normalizeReceivables({status:200,registros:[
 {empresa:'A.C DA COSTA DELIBERALI',parceiro:'CLIENTE A',fatura:'A',dataEmissao:'2026-10-01',valor:200,valorResidual:150,valorPagamento:50},
 {empresa:'Comércio Exterior Costa Log Ltda',parceiro:'CLIENTE B',fatura:'B',dataEmissao:'2026-10-01',valor:300,valorResidual:0,valorPagamento:300},
 {empresa:'CRC COSTA',parceiro:'CLIENTE C',fatura:'C',dataEmissao:'2026-10-01',valor:400,valorResidual:400,valorPagamento:null},
 {empresa:'IDEALLOG Transportes',parceiro:'CLIENTE D',fatura:'D',dataEmissao:'2026-10-01',valor:500,valorResidual:400,valorPagamento:100},
 {empresa:'EMPRESA DESCONHECIDA',parceiro:'CLIENTE E',fatura:'E',dataEmissao:'2026-10-01',valor:600,valorResidual:600,valorPagamento:null},
 {empresa:'',parceiro:'CLIENTE F',fatura:'F',dataEmissao:'2026-10-01',valor:700,valorResidual:700,valorPagamento:null}
]});
test('Quatro empresas oficiais e categoria sem identificação preservam todas as parcelas',()=>{
 assert.deepEqual(COSTALOG_COMPANIES,['A.C DA COSTA DELIBERALI','COMEX COSTA LOG','CRC COSTA','IDEALLOG']);
 assert.equal(companyOfReceivable(data[1]),'COMEX COSTA LOG');
 assert.equal(companyOfReceivable(data[3]),'IDEALLOG');
 assert.equal(companyOfReceivable(data[4]),COMPANY_UNIDENTIFIED);
 assert.equal(companyOfReceivable(data[5]),COMPANY_UNIDENTIFIED);
 assert.deepEqual(companyDistribution(data).map(x=>x.count),[1,1,1,1,2]);
 assert.strictEqual(receivablesByCompany(data,'all'),data);
 assert.strictEqual(receivablesByCompany(data,'IDEALLOG'),receivablesByCompany(data,'IDEALLOG'));
 assert.equal(receivablesByCompany(data,'CRC COSTA')[0].fatura,'C');
 assert.equal(receivablesByCompany(data,COMPANY_UNIDENTIFIED).length,2);
 assert.equal(receivablesByCompany(data,'EMPRESA DESCONHECIDA').length,0);
});
test('Filtro aplica-se aos totais e gráficos, sem misturar empresas e parceiros',()=>{
 const ui={from:'2026-10-01',to:'2026-10-21',recvRef:'E',recvSource:'live',recvPage:1,recvSortKey:'prioridade',recvCompany:'CRC COSTA'};
 const html=renderReceivables(data,ui);
 assert(html.includes('CLIENTE C'));
 assert(!html.includes('<td>CLIENTE A</td>'));
 assert(html.includes('Saldo RESIDUAL informado por parceiro'));
 const g=receivablesSummary(receivablesByCompany(data,'CRC COSTA'));
 assert.equal(g.residual,400);
 assert.equal(g.face,400);
 assert.equal(g.paidKnown,0);
 const companyHtml=renderCompanyFilter(data,ui);
 for(const label of COSTALOG_COMPANIES)assert(companyHtml.includes(label));
 assert(companyHtml.includes('Outras / não identificadas'));
 const allHtml=renderReceivables(data,{...ui,recvCompany:'all'});
 assert(allHtml.includes('RESUMO FINANCEIRO POR EMPRESA'));
 assert(allHtml.includes('Saldo residual por empresa (DSS)'));
 assert.equal((allHtml.match(/<tbody>/g)||[]).length,2,'Apenas parcelas e faixas de vencimento usam tabelas');
});
test('Painel e Visão Gerencial calculam recebíveis da empresa selecionada',()=>{
 const state={mode:'live',from:'2026-10-01',to:'2026-10-21',recvRows:data,recvSource:'live',recvCompany:'CRC COSTA',recvRef:'E',docsSource:'live'};
 const dataset={viagens:[],pedidos:[],ctes:[],mdfes:[],sources:{viagens:true,pedidos:true}};
 const dash=renderFinanceDashboard(dataset,state);
 assert(dash.includes('CRC COSTA'));
 assert(dash.includes('400,00'));
 const manager=renderManagerialDashboard([],[],state);
 assert(manager.includes('VISÃO GERENCIAL DSS'));
 assert(manager.includes('400,00'));
 assert(manager.includes('não contém campo empresa'));
});
test('O servidor entrega o módulo novo no Render e o filtro usa somente o campo empresa',()=>{
 const server=readFileSync('api/server.mjs','utf8'),app=readFileSync('src/app.js','utf8');
 assert(server.includes("'companies.mjs'"));
 assert(app.includes("if(e.target.id==='recvCompany')"));
 assert(app.includes("renderCompanyFilter(state.recvRows,state,state.dataset)"));
 const source=readFileSync('src/companies.mjs','utf8');
 assert(!source.includes('row?.parceiro'));
});
