import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizeReceivables,RECEIVABLE_FIELDS,receivablesSummary} from '../src/receivables.mjs';
import {renderReceivables,filteredReceivables,renderReceivablesTokenDialog} from '../src/receivables-ui.mjs';
import {queryReceivables,ReceivablesQueryError} from '../api/receivables.mjs';
import {fetchAuthorizedReceivables} from '../src/dss-sync.mjs';

const sample={status:200,apiVersion:1,mensagemErro:'',qtd_registros:3,registros:[
 {empresa:'COSTALOG',dataEmissao:'01/10/2026',parceiro:'Cliente A',cnpjCpfParceiro:'00000000000000',parcela:'1/2',
 fatura:'F-11',nroDocumento:'DOC-11',historico:'Serviços',obsFatura:'Teste',
 tipoFatura:'FRETE',qtdDiasAberto:10,situacaoFatura:'ABERTA',dataVencimento:'01/10/2026',
 dataVencimentoOriginal:'01/10/2026',valor:2000,valorPagamento:0,metodoPagamento:'PIX',
 centroCusto:'EXP',faturaCriadaPor:'Sistema',bordero:'B-1',formaPagamento:'PIX',
 lote:'10',dataPagamento:'',valorDesconto:0,valorAcrescimo:0,diarioPagamento:'',
 valorResidual:2000,cteFreteMunicipal:'C-01',conta:'CONTA01',codigoConta:'CC',
 nomeConta:'Conta Teste',dataReferencia:'01/10/2026',valorTotal:2000,linhaDigitavel:'123456789'},
 {empresa:'COSTALOG',dataEmissao:'02/10/2026',parceiro:'Cliente B',parcela:'1/1',fatura:'F-12',
 situacaoFatura:'PAGA',dataVencimento:'10/10/2026',dataPagamento:'11/10/2026',
 valor:1000,valorPagamento:1000,valorResidual:0,valorDesconto:0,valorAcrescimo:0},
 {empresa:'COSTALOG',dataEmissao:'03/10/2026',parceiro:'Cliente C',parcela:'1/1',fatura:'F-13',
 situacaoFatura:'ABERTA',dataVencimento:'20/10/2026',dataPagamento:'',
 valor:null,valorPagamento:null,valorResidual:null}
]};
const validEnv={DSS_BASE_URL:'https://api.example.test/wsdss',DSS_RECEIVABLES_PATH:'/rota_exata_do_swagger',
 DSS_AUTH_TYPE:'basic',DSS_USERNAME:'testuser',DSS_PASSWORD:'somente-mock'};
test('Normaliza todos os campos documentados sem perder zero, datas ou valor ausente',()=>{
 const rows=normalizeReceivables(sample);
 assert.equal(Object.keys(RECEIVABLE_FIELDS).length,34);
 assert.deepEqual(Object.keys(rows[0]).sort(),Object.keys(RECEIVABLE_FIELDS).sort());
 assert.equal(rows[0].valorResidual,2000);assert.equal(rows[0].valorPagamento,0);
 assert.equal(rows[0].dataVencimento,'2026-10-01');
 assert.equal(rows[2].valor,null);
 assert.equal(rows[2].valorResidual,null);
 assert.equal(rows[0].linhaDigitavel,'123456789');
 const stat=receivablesSummary(rows,{today:'2026-10-20'});
 assert.equal(stat.count,3);assert.equal(stat.face,3000);assert.equal(stat.faceKnown,2);
 assert.equal(stat.paid,1000);assert.equal(stat.paidCount,1);
 assert.equal(stat.residual,2000);assert.equal(stat.residualKnown,2);
 assert.equal(stat.lateCount,1);assert.equal(stat.lateResidual,2000);
});
test('Proxy usa tipo_ref E/V/P e converte data_inicio/data_fim em DD/MM/AAAA',async()=>{
 for(const tipoRef of ['E','V','P']){
  let captured;
  const data=await queryReceivables({env:validEnv,from:'2026-10-01',to:'2026-10-20',tipoRef,fetchImpl:async(url,opts)=>{
   captured={url,opts};return {status:200,ok:true,json:async()=>sample};
  }});
  assert.equal(captured.url.pathname,'/wsdss/rota_exata_do_swagger');
  assert.equal(captured.url.searchParams.get('data_inicio'),'01/10/2026');
  assert.equal(captured.url.searchParams.get('data_fim'),'20/10/2026');
  assert.equal(captured.url.searchParams.get('tipo_ref'),tipoRef);
  assert.equal(captured.opts.headers.Authorization,'Basic '+Buffer.from('testuser:somente-mock').toString('base64'));
  assert.equal(data.registros.length,3);
  assert.equal(data.tipoRef,tipoRef);
 }
});
test('Sem datas, DSS usa hoje; nunca substituímos o padrão por data arbitrária',async()=>{
 let captured;
 await queryReceivables({env:validEnv,fetchImpl:async(url)=>{captured=url;return {status:200,ok:true,json:async()=>({...sample,qtd_registros:0,registros:[]})};}});
 assert.equal(captured.searchParams.get('data_inicio'),null);
 assert.equal(captured.searchParams.get('data_fim'),null);
 assert.equal(captured.searchParams.get('tipo_ref'),'E');
});
test('Proteção do proxy: falta de rota, filtros inválidos, 401/403 e status embutidos',async()=>{
 await assert.rejects(()=>queryReceivables({env:{...validEnv,DSS_RECEIVABLES_PATH:''}}),e=>e.status===503&&/DSS_RECEIVABLES_PATH/.test(e.message));
 await assert.rejects(()=>queryReceivables({env:validEnv,from:'2026-02-31',to:'2026-10-01'}),e=>e.status===400);
 await assert.rejects(()=>queryReceivables({env:validEnv,tipoRef:'X'}),e=>e.status===400);
 await assert.rejects(()=>queryReceivables({env:validEnv,fetchImpl:async()=>({status:403,ok:false})}),e=>e.status===403&&/tms_financeiro/.test(e.message));
 await assert.rejects(()=>queryReceivables({env:validEnv,fetchImpl:async()=>({status:200,ok:true,json:async()=>({...sample,status:403})})}),e=>e.status===403);
 await assert.rejects(()=>queryReceivables({env:validEnv,fetchImpl:async()=>({status:404,ok:false})}),e=>e.status===502&&/DSS_RECEIVABLES_PATH/.test(e.message));
});
test('Token do navegador enviado somente ao proxy autorizado, sem persistência',async()=>{
 const secret='token-privado-mock-12345678901234567890';
 const rows=await fetchAuthorizedReceivables({token:secret,from:'2026-10-01',to:'2026-10-20',tipoRef:'V',fetchImpl:async(url,opts)=>{
  assert.equal(new URL(url).pathname,'/api/receivables');
  assert.equal(new URL(url).searchParams.get('tipo_ref'),'V');
  assert.equal(opts.headers.Authorization,'Bearer '+secret);
  assert.equal(opts.credentials,'omit');
  return {status:200,ok:true,json:async()=>({registros:normalizeReceivables(sample)})};
 }});
 assert.equal(rows.length,3);
 assert(!readFileSync('src/dss-sync.mjs','utf8').includes(secret));
 await assert.rejects(()=>fetchAuthorizedReceivables({token:secret,from:'2026-10-01',to:'2026-10-20',tipoRef:'P',
  fetchImpl:async()=>({status:403,ok:false,json:async()=>({error:'Habilite tms_financeiro'})})}),/tms_financeiro/);
});
test('Tabela exibe 25 parcelas por página e permite expandir 34 campos sem HTML perigoso',()=>{
 const data=Array.from({length:100},(_,i)=>({...normalizeReceivables(sample)[0],
  fatura:'F-'+i,parceiro:i===3?'<img src=x onerror=alert(1)>':'Cliente '+i,
  valor:100+i,valorResidual:100+i}));
 const a={from:'2026-10-01',to:'2026-10-20',recvRef:'E',recvSortKey:'valor',recvSortDir:'desc',recvSource:'live',recvPage:1};
 const rows=filteredReceivables(data,a);
 assert.equal(rows.length,100);
 const h=renderReceivables(data,a);
 assert.equal((h.match(/<tbody>/g)||[]).length,1);
 assert.equal((h.match(/<tr>/g)||[]).length,26);
 assert(h.includes('F-99'));assert(!h.includes('F-0</td>'));
 assert(h.includes('Linha digitável'));
 assert(!h.includes('<img src=x onerror'));
 assert(h.includes('data-action="recv-next"'));
 const h2=renderReceivables(data,{...a,recvPage:2});
 assert.equal((h2.match(/<tr>/g)||[]).length,26);
 assert.notEqual(h,h2);
 const dlg=renderReceivablesTokenDialog(a);
 assert(dlg.includes('id="receivablesSyncForm"'));assert(dlg.includes('type="password"'));
});
test('Render serve módulos importados, protege Contas a Receber e conserva a saúde sem DSS',()=>{
 const backend=readFileSync('api/server.mjs','utf8');
 for(const path of ['managerial-ui.mjs','receivables.mjs','receivables-ui.mjs'])assert(backend.includes("'"+path+"'"));
 assert(backend.includes("url.pathname==='/api/receivables'"));
 assert(backend.includes("if(!allowedBySession&&!docsSyncAuthorized(req))"));
 assert(backend.includes("url.pathname==='/api/health'"));
 const app=readFileSync('src/app.js','utf8');
 assert(app.includes("['receber','doc','Contas a Receber']"));
 assert(app.includes("fetchAuthorizedReceivables({token,from,to,tipoRef:'E'})"));
 assert(app.includes("'Contas a Receber não sincronizado: '+receivables.message"));
 assert(app.includes('renderReceivables(state.recvRows,state)'));
});
