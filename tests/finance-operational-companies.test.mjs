import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizeOverview} from '../src/dss-mapping.mjs';
import {companyOfOperation,overviewByCompany,operationalCompanyMetrics,COMPANY_UNIDENTIFIED,COSTALOG_COMPANIES} from '../src/companies.mjs';
import {renderOperationalCompanies} from '../src/company-operations-ui.mjs';
import {renderFinanceDashboard,renderFinanceComparison} from '../src/financial-ui.mjs';

const base=normalizeOverview({data:{
 viagens:[
  {rv_id:1001,nro_rv:1001,data_inicio:'2026-10-03',empresa:'CRC DA COSTA',cliente_nome:'Cliente X',total_km_rodados:50},
  {rv_id:1002,nro_rv:1002,data_inicio:'2026-10-04',empresa:'COMEX COSTA LOG',cliente_nome:'Cliente X',total_km_rodados:80},
  {rv_id:1003,nro_rv:1003,data_inicio:'2026-10-05',empresa:'IDEALLOG',cliente_nome:'Cliente Y',total_km_rodados:90},
  {rv_id:1004,nro_rv:1004,data_inicio:'2026-10-06',empresa:'EMPRESA DESCONHECIDA',cliente_nome:'Cliente Z',total_km_rodados:12}
 ],
 pedidos:[
  {pf_id:10,nro_pf:10,data_emissao:'2026-10-03',empresa:'CRC DA COSTA',cliente_nome:'Cliente X',total_frete:1250,valor_receber:1000,nro_cte:100},
  {pf_id:11,nro_pf:11,data_emissao:'2026-10-04',empresa:'COMEX COSTA LOG',cliente_nome:'Cliente X',total_frete:3300,valor_receber:3300,nro_cte:101},
  {pf_id:12,nro_pf:12,data_emissao:'2026-10-05',empresa:'IDEALLOG',cliente_nome:'Cliente Y',total_frete:1500,valor_receber:1500,nro_cte:102},
  {pf_id:13,nro_pf:13,data_emissao:'2026-10-06',empresa:'EMPRESA DESCONHECIDA',cliente_nome:'Cliente Z',total_frete:600,valor_receber:600,nro_cte:103}
 ],
 ctes:[],mdfes:[],ocorrencias:[],
 sources:{viagens:true,pedidos:true,mdfes:false}
}});

test('Viagens e pedidos já normalizam empresa presente na API DSS',()=>{
 assert.equal(companyOfOperation(base.viagens[0]),'CRC COSTA');
 assert.equal(companyOfOperation(base.pedidos[1]),'COMEX COSTA LOG');
 assert.equal(companyOfOperation(base.pedidos[2]),'IDEALLOG');
 assert.equal(companyOfOperation(base.pedidos[3]),COMPANY_UNIDENTIFIED);
 assert.equal(companyOfOperation({empresa:'',cliente:'CRC COSTA'}),COMPANY_UNIDENTIFIED,'Não inventar empresa a partir do cliente');
});

test('Filtro por empresa é aplicado a pedidos, viagens e CT-e sem dupla soma',()=>{
 const crc=overviewByCompany(base,'CRC COSTA');
 assert.equal(crc.pedidos.length,1);
 assert.equal(crc.viagens.length,1);
 assert.equal(crc.ctes.length,1);
 assert.equal(crc.pedidos[0].valor,1250);
 assert.equal(crc.pedidos[0].valorReceber,1000);
 assert.strictEqual(crc,overviewByCompany(base,'CRC COSTA'),'Navegar entre páginas não refiltra dados');
 assert.strictEqual(overviewByCompany(base,'all'),base);
 assert.equal(overviewByCompany(base,'COMEX COSTA LOG').pedidos[0].valor,3300);
 assert.equal(overviewByCompany(base,COMPANY_UNIDENTIFIED).pedidos[0].valor,600);
 assert.equal(operationalCompanyMetrics(base).reduce((s,g)=>s+g.pedidos,0),4);
 assert.equal(operationalCompanyMetrics(base).reduce((s,g)=>s+g.valorFrete,0),6650);
 assert.equal(operationalCompanyMetrics(crc).reduce((s,g)=>s+g.valorFrete,0),1250);
});

test('Gráfico financeiro lista quatro empresas e mantém grupo não identificado',()=>{
 const html=renderOperationalCompanies(base,{mode:'live',recvCompany:'all'});
 for(const company of COSTALOG_COMPANIES)if(['CRC COSTA','COMEX COSTA LOG','IDEALLOG'].includes(company))assert(html.includes(company));
 assert(html.includes('Outras / não identificadas'));
 assert(html.includes('R$'));
 assert(html.includes('1 pedidos')&&html.includes('1 viagens'));
 assert(html.includes('CT-e não é somado outra vez'));
 const onlyCrc=renderOperationalCompanies(overviewByCompany(base,'CRC COSTA'),{mode:'live'});
 assert(onlyCrc.includes('CRC COSTA'));
 assert(!onlyCrc.includes('COMEX COSTA LOG'));
});

test('Comparativo mantém datas independentes e aplica a MESMA empresa em ambos os períodos',()=>{
 const state={
  compareCurrentFrom:'2026-10-01',compareCurrentTo:'2026-10-31',
  comparePreviousFrom:'2026-09-01',comparePreviousTo:'2026-09-30',
  recvCompany:'CRC COSTA',comparisonLoading:false,comparisonError:'',
  comparison:{
   currentRange:{from:'2026-10-01',to:'2026-10-31'},
   previousRange:{from:'2026-09-01',to:'2026-09-30'},
   current:base,previous:base
  }
 };
 const h=renderFinanceComparison(base,state);
 assert(h.includes('Empresa: CRC COSTA'));
 assert(h.includes('2026-10-01'));
 assert(h.includes('2026-09-01'));
 assert(h.includes('1.250,00'));
 assert(!h.includes('6.650,00'),'Não somar pedidos de outras empresas');
 assert.equal(state.comparison.current.pedidos.length,4,'Preservar dados originais do comparativo');
 const dash=renderFinanceDashboard(overviewByCompany(base,'CRC COSTA'),
  {mode:'live',from:'2026-10-01',to:'2026-10-31',recvSource:'pending',recvCompany:'CRC COSTA',recvRows:[]});
 assert(dash.includes('Aguardando dados financeiros'));
 assert(!dash.includes('Fretes informados'));
 assert(!dash.includes('1.250,00'));
 assert(!dash.includes('COMEX COSTA LOG'));
});
test('Separação funciona no Faturamento e CT-e e não cria API de parceiros/motoristas desnecessária',()=>{
 const app=readFileSync('src/app.js','utf8');
 const advanced=readFileSync('src/advanced-ui.mjs','utf8');
 const server=readFileSync('api/server.mjs','utf8');
 assert(app.includes("state.recvCompany||'all'"));
 assert(app.includes("overviewByCompany(value,state.recvCompany||'all')"));
 assert(app.includes("{key:'empresa',label:'Empresa'}"));
 assert(advanced.includes("{key:'empresa',label:'Empresa'}"));
 assert(server.includes("'company-operations-ui.mjs'"));
 assert(!server.includes("DSS_PARCEIROS_PATH"));
});
