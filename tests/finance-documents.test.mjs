import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizeElectronicDocuments,isoEmissionDate,summaryElectronicDocuments} from '../src/e-documents.mjs';
import {renderElectronicDocuments,filteredElectronicDocuments,docsCsv} from '../src/e-documents-ui.mjs';
import {queryElectronicDocuments,DocumentQueryError} from '../api/e-documents.mjs';
const sample={status:200,apiVersion:1,mensagemErro:'',qtd_registros:2,registros:[
{id:0,parceiro:'Teste A',tipo_operacao:'Serviços',numero_nfse:'101',modelo:'NFS-e',status:'Emitida',data_emissao:'10/10/2026',valor_final:1300.25,total_iss:65.01,fatura:'F-001',ponto_apoio:'Santos'},
{id:2,parceiro:'Teste B',tipo_operacao:'Fretes',numero_nfse:'102',modelo:'NFS-e',status:'Pendente',data_emissao:'11/10/2026',valor_final:0,total_iss:0,fatura:'',ponto_apoio:'Guarujá'}
]};
const env={DSS_BASE_URL:'https://api.example.org/wsdss',DSS_DOCUMENTOS_PATH:'/rota_confirmada_no_swagger',DSS_USERNAME:'usuario',DSS_PASSWORD:'chave-teste-interna-123',DSS_AUTH_TYPE:'basic'};
test('Normaliza todos os 11 campos sem transformar zero em vazio',()=>{
 const docs=normalizeElectronicDocuments(sample);
 assert.equal(docs.length,2);assert.equal(docs[0].id,'0');
 assert.equal(docs[0].dataEmissao,'2026-10-10');
 assert.equal(docs[0].valorFinal,1300.25);
 assert.equal(docs[0].totalIss,65.01);
 assert.equal(docs[1].valorFinal,0);assert.equal(docs[1].totalIss,0);
 assert.equal(summaryElectronicDocuments(docs).valorFinal.sum,1300.25);
 assert.equal(summaryElectronicDocuments(docs).withFatura,1);
 assert.equal(isoEmissionDate('31/02/2026'),'');
});
test('Consulta backend formata intervalo DSS e insere Basic Auth somente no servidor',async()=>{
 let fetched;
 const result=await queryElectronicDocuments({env,from:'2026-10-01',to:'2026-10-20',fetchImpl:async(url,opts)=>{
  fetched={url,opts};return {status:200,ok:true,async json(){return sample;}};
 }});
 assert.equal(fetched.url.searchParams.get('data_inicio'),'01/10/2026');
 assert.equal(fetched.url.searchParams.get('data_fim'),'20/10/2026');
 assert.equal(fetched.url.pathname,'/wsdss/rota_confirmada_no_swagger');
 assert.equal(fetched.opts.headers.Authorization,'Basic '+Buffer.from('usuario:chave-teste-interna-123').toString('base64'));
 assert.equal(result.registros.length,2);
 assert.equal(result.registros[0].numeroNfse,'101');
 assert.equal(result.registros[0].parceiro,'Teste A');
});
test('Sem datas, não envia filtros e preserva retorno do DSS',async()=>{
 let fetched;
 await queryElectronicDocuments({env,fetchImpl:async(url)=>{fetched=url;return {status:200,ok:true,json:async()=>({...sample,registros:[],qtd_registros:0})};}});
 assert.equal(fetched.search,'');
});
test('Falhas 400, 401, 403, 500, rota ausente e datas são tratadas sem revelar segredos',async()=>{
 await assert.rejects(()=>queryElectronicDocuments({env:{...env,DSS_DOCUMENTOS_PATH:''}}),e=>e.status===503);
 await assert.rejects(()=>queryElectronicDocuments({env,from:'2026-01-01'}),e=>e.status===400);
 await assert.rejects(()=>queryElectronicDocuments({env,from:'2026-02-31',to:'2026-10-01'}),e=>e.status===400);
 const response=(status,json)=>({status,ok:status===200,async json(){return json??sample;}});
 await assert.rejects(()=>queryElectronicDocuments({env,fetchImpl:async()=>response(401)}),e=>e.status===502&&!e.message.includes(env.DSS_PASSWORD));
 await assert.rejects(()=>queryElectronicDocuments({env,fetchImpl:async()=>response(403)}),e=>e.status===403&&e.message.includes('tms_faturamento'));
 await assert.rejects(()=>queryElectronicDocuments({env,fetchImpl:async()=>response(200,{...sample,status:403})}),e=>e.status===403);
 await assert.rejects(()=>queryElectronicDocuments({env,fetchImpl:async()=>response(500)}),e=>e.status===502);
 await assert.rejects(()=>queryElectronicDocuments({env,fetchImpl:async()=>response(200,{...sample,qtd_registros:3})}),e=>e.status===502);
});
test('Tabela NFS-e, filtros, indicadores e CSV preservam separação do portal',()=>{
 const rows=normalizeElectronicDocuments(sample);
 const state={from:'2026-10-11',to:'2026-10-31',search:'',mode:'demo',docsLoading:false,docsError:''};
 assert.equal(filteredElectronicDocuments(rows,state).length,1);
 const html=renderElectronicDocuments(rows,state);
 assert(html.includes('DOCUMENTOS ELETRÔNICOS / NFS-e'));
 assert(html.includes('EXEMPLOS')||html.includes('DEMONSTRAÇÃO'));
 assert(html.includes('CLIENTE EXEMPLO')===false);
 assert(html.includes('Teste B'));assert(!html.includes('Teste A'));
 assert(html.includes('EXPORTAR DOCUMENTOS CSV'));
 const malicious=normalizeElectronicDocuments({status:200,registros:[{numero_nfse:'<script>alert(1)</script>',parceiro:'=HYPERLINK("x")',data_emissao:'10/10/2026',valor_final:0}]});
 assert(!renderElectronicDocuments(malicious,{...state,from:''}).includes('<script>'));
 assert(docsCsv(malicious,{...state,from:''}).includes("'=HYPERLINK"));
});
test('Endpoint HTTP permanece protegido e senha não aparece no bundle público',()=>{
 const code=readFileSync('api/server.mjs','utf8');
 const route=code.slice(code.indexOf("if(url.pathname==='/api/documentos-eletronicos')"));
 assert(route.startsWith("if(url.pathname==='/api/documentos-eletronicos')"));
 assert(route.indexOf('if(!user)')<route.indexOf('queryElectronicDocuments'));
 assert(route.indexOf('if(!user.permissions?.financeiro)')<route.indexOf('queryElectronicDocuments'));
 const client=readFileSync('src/app.js','utf8');
 assert(client.includes("['documentos','doc','Documentos / NFS-e']"));
 assert(client.includes("renderElectronicDocuments(state.docsRows,state)"));
 assert(client.includes("if(PUBLIC_DEMO||state.mode!=='live'||!state.token||!state.apiUrl)"));
 assert.equal(readFileSync('src/site-config.mjs','utf8').includes("export const API_BASE_URL = '';"),true);
});
