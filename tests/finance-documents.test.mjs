import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizeElectronicDocuments,isoEmissionDate,summaryElectronicDocuments} from '../src/e-documents.mjs';
import {renderElectronicDocuments,renderDocumentsSyncDialog,filteredElectronicDocuments,docsCsv} from '../src/e-documents-ui.mjs';
import {fetchAuthorizedDocuments,fetchAuthorizedOverview,FATURAMENTO_RENDER_API} from '../src/dss-sync.mjs';
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
 assert(html.includes('EXPORTAR CSV'));
 assert(html.includes('id="docsSortKey"'));
 assert(html.includes('data-doc-sort="valorFinal"'));
 assert(!html.includes('data-action="docs-sync-open"'));
 assert(html.includes('id="docsStatus"'));
 const malicious=normalizeElectronicDocuments({status:200,registros:[{numero_nfse:'<script>alert(1)</script>',parceiro:'=HYPERLINK("x")',data_emissao:'10/10/2026',valor_final:0}]});
 assert(!renderElectronicDocuments(malicious,{...state,from:''}).includes('<script>'));
 assert(docsCsv(malicious,{...state,from:''}).includes("'=HYPERLINK"));
});
test('Endpoint HTTP permanece protegido e senha não aparece no bundle público',()=>{
 const code=readFileSync('api/server.mjs','utf8');
 const route=code.slice(code.indexOf("if(url.pathname==='/api/documentos-eletronicos')"));
 assert(route.startsWith("if(url.pathname==='/api/documentos-eletronicos')"));
 assert(route.indexOf('docsSyncAuthorized(req)')<route.indexOf('queryElectronicDocuments'));
 assert(code.includes("env.DSS_NFSE_SYNC_TOKEN"));
 assert(code.includes("secret.length<32"));
 assert(!code.includes("docsSyncAuthorized(req))return reply(res,200"));
 assert(!code.includes("DSS_NFSE_SYNC_TOKEN='"));
 const client=readFileSync('src/app.js','utf8');
 assert(client.includes("['documentos','doc','Documentos / NFS-e']"));
 assert(client.includes("renderElectronicDocuments(state.docsRows,state)"));
 assert(client.includes("synchronizeElectronicDocuments(token)"),'A consulta é acionada apenas após autorização explícita');
 assert(client.includes("if(input)input.value=''"),'O token é removido do campo após o envio');
 assert(client.includes("fetchAuthorizedDocuments({token,from,to})"),'O acesso real usa somente o proxy protegido');
 assert(!client.includes('DSS_NFSE_SYNC_TOKEN='));
 assert(!client.includes('localStorage.setItem(\'docsSyncToken\''));
 assert.equal(readFileSync('src/site-config.mjs','utf8').includes("export const API_BASE_URL = '';"),true);
});

test('Botão de sincronizar NFS-e e formulário de autorização em memória',()=>{
 const html=renderElectronicDocuments(normalizeElectronicDocuments(sample),{mode:'demo',docsSource:'demo',docsLoading:false,docsError:'',from:'2026-10-01',to:'2026-10-20'});
 assert(!html.includes('data-action="docs-sync-open"'));
 assert(html.includes('SINCRONIZAR COM DSS'));
 assert(html.includes('DEMONSTRAÇÃO'));
 const modal=renderDocumentsSyncDialog({from:'2026-10-01',to:'2026-10-20'});
 assert(modal.includes('id="docsSyncForm"'));
 assert(modal.includes('type="password"'));
 assert(modal.includes('autocomplete="off"'));
 assert(!modal.includes('Bearer '));
 assert(!modal.includes('chave-teste-interna-123'));
 assert.equal(FATURAMENTO_RENDER_API,'https://faturamento-sq74.onrender.com');
});
test('Sincronização DSS envia Bearer privado apenas na requisição autenticada',async()=>{
 let calls=0;const token='token-privado-apenas-teste-001';
 const docs=await fetchAuthorizedDocuments({token,from:'2026-10-01',to:'2026-10-20',fetchImpl:async(url,opts)=>{
  calls++;
  assert.equal(url,'https://faturamento-sq74.onrender.com/api/documentos-eletronicos?from=2026-10-01&to=2026-10-20');
  assert.equal(opts.headers.Authorization,'Bearer '+token);
  assert.equal(opts.credentials,'omit');assert.equal(opts.cache,'no-store');
  return {status:200,ok:true,json:async()=>({registros:[{numeroNfse:'200',parceiro:'PARCEIRO EXEMPLO',valorFinal:75}]})};
 }});
 assert.equal(calls,1);assert.equal(docs[0].numeroNfse,'200');
 const source=readFileSync('src/dss-sync.mjs','utf8');
 assert(!source.includes(token));
 assert(!source.includes('localStorage'));
 assert(!source.includes('sessionStorage'));
});
test('Falhas de token e servidor não aparentam sincronização bem-sucedida',async()=>{
 await assert.rejects(()=>fetchAuthorizedDocuments({token:'curto',from:'2026-10-01',to:'2026-10-20'}),/token privado/i);
 await assert.rejects(()=>fetchAuthorizedDocuments({token:'token-comprido-teste',from:'2026-10-01',to:'2026-10-20',fetchImpl:async()=>({status:401,ok:false,json:async()=>({error:'Não autorizado'})})}),/Token não autorizado/);
 await assert.rejects(()=>fetchAuthorizedDocuments({token:'token-comprido-teste',from:'2026-10-01',to:'2026-10-20',fetchImpl:async()=>({status:503,ok:false,json:async()=>({error:'DSS_DOCUMENTOS_PATH ausente'})})}),/DSS_DOCUMENTOS_PATH/);
});

test('Tabela NFS-e ordena valor final numericamente e filtra por situação/termo',()=>{
 const rows=normalizeElectronicDocuments(sample);
 let ordered=filteredElectronicDocuments(rows,{from:'2026-10-01',to:'2026-10-20',search:''});
 assert.deepEqual(ordered.map(x=>x.numeroNfse),['101','102']);
 ordered=filteredElectronicDocuments(rows,{from:'2026-10-01',to:'2026-10-20',docsSortKey:'valorFinal',docsSortDir:'asc'});
 assert.deepEqual(ordered.map(x=>x.numeroNfse),['102','101']);
 assert.equal(filteredElectronicDocuments(rows,{docsStatus:'Pendente'}).length,1);
 assert.equal(filteredElectronicDocuments(rows,{search:'TESTE A'}).length,1);
 assert.equal(filteredElectronicDocuments(rows,{search:'1300.25'}).length,1);
});
test('Token autoriza leitura global de overview, mas não endpoints administrativos',async()=>{
 const code=readFileSync('api/server.mjs','utf8');
 const marker=code.slice(code.indexOf("if(url.pathname!=='/api/overview')"));
 assert(marker.includes('const syncByToken=docsSyncAuthorized(req)'));
 assert(marker.includes("const overviewRole=syncByToken?'financeiro':user.role;"));
 assert(marker.includes('projectOverview(payload,overviewRole)'));
 assert(marker.includes('projectOverview({...cached,cacheHit:true},overviewRole)'));
 assert(!code.slice(code.indexOf("if(url.pathname==='/api/users'"),code.indexOf("if(url.pathname==='/api/documentos-eletronicos')")).includes('docsSyncAuthorized'));
 let calls=0;
 const token='token-privado-teste-global-2026';
 const overview=await fetchAuthorizedOverview({token,from:'2026-10-01',to:'2026-10-20',fetchImpl:async(url,opts)=>{
  calls++;assert(url.includes('/api/overview?from=2026-10-01&to=2026-10-20'));
  assert(url.includes('refresh=recent'));
  assert.equal(opts.headers.Authorization,'Bearer '+token);
  return {status:200,ok:true,json:async()=>({data:{viagens:[],pedidos:[]}})};
 }});
 assert.equal(calls,1);assert.equal(overview.data.pedidos.length,0);
 await assert.rejects(()=>fetchAuthorizedOverview({token,from:'2026-10-01',to:'2026-10-20',fetchImpl:async()=>({status:401,ok:false,json:async()=>({error:'negado'})})}),/não autorizado/);
});
