import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('Painel sincroniza todas as abas do Faturamento com DSS mediante token temporário',async()=>{
 const events={},storage=new Map(),root={innerHTML:'',addEventListener(k,f){events[k]=f;}};
 const syncToken={value:'autorizacao-temporaria-teste-2026',focus(){}};
 globalThis.localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)};
 globalThis.window={location:{protocol:'https:',origin:'https://empresa.github.io',hostname:'empresa.github.io'}};
 globalThis.alert=()=>{};globalThis.confirm=()=>true;
 globalThis.document={getElementById:id=>id==='app'?root:id==='docsSyncToken'?syncToken:null,addEventListener(){},visibilityState:'visible'};
 let count=0,refQueries=[];
 globalThis.fetch=async()=>{throw Error('Não buscar DSS automaticamente na abertura pública');};
 await import('../src/app.js?finance-global-sync=1');
 assert(root.innerHTML.includes('RESUMO DE FATURAS'));
 assert(root.innerHTML.includes('SINCRONIZAR COM DSS'));
 assert(root.innerHTML.includes('id="from"'));assert(root.innerHTML.includes('id="to"'));
 assert(!root.innerHTML.includes('loginForm'));
 assert(!root.innerHTML.includes('data-nav="analises"'));
 assert(!root.innerHTML.includes('data-nav="relatorios"'));
 const nav=v=>events.click({target:{closest:q=>q==='[data-nav]'?{dataset:{nav:v}}:null}});
 nav('documentos');
 assert(root.innerHTML.includes('NOTAS FISCAIS E DOCUMENTOS'));
 assert.equal((root.innerHTML.match(/data-action="docs-sync-open"/g)||[]).length,1,'Um único botão, no cabeçalho de datas');
 assert(root.innerHTML.includes('id="docsSortKey"'));
 assert(root.innerHTML.includes('Valor final'));
 const action=id=>events.click({target:{dataset:{},closest:q=>q==='[data-action]'?{dataset:{action:id}}:null}});
 nav('painel');action('docs-sync-open');
 assert(root.innerHTML.includes('id="docsSyncForm"'));
 globalThis.fetch=async(url,options)=>{
  count++;
  assert.equal(options.headers.Authorization,'Bearer autorizacao-temporaria-teste-2026');
  assert(url.startsWith('https://faturamento-sq74.onrender.com/api/'));
  if(url.includes('/api/documentos-eletronicos?'))
   return {status:200,ok:true,json:async()=>({registros:[{id:'1',numeroNfse:'NFS-2026-900',parceiro:'PARCEIRO TESTE',dataEmissao:'2026-10-19',valorFinal:42,totalIss:2}]})};
  if(url.includes('/api/receivables?')){
   const ref=new URL(url).searchParams.get('tipo_ref');
   refQueries.push(ref);
   return {status:200,ok:true,json:async()=>({registros:[{
     empresa:'CRC COSTA',fatura:'REF-'+ref,parcela:'1/1',parceiro:'TESTE FINANCEIRO',
     valor:ref==='E'?500:ref==='V'?300:200,valorPagamento:ref==='P'?200:0,
     valorResidual:ref==='P'?0:100,dataEmissao:'2026-10-19',dataVencimento:'2026-10-20',
     dataPagamento:ref==='P'?'2026-10-20':'',situacaoFatura:ref==='P'?'Pago':'Aberto'
   }]})};
  }
  if(url.includes('/api/overview?'))
   return {status:200,ok:true,json:async()=>({data:{
    viagens:[],pedidos:[{pf_id:900,nro_pf:900,cliente_nome:'EMPRESA TESTE',data_emissao:'2026-10-19',total_frete_pedido_frete:250}],
    ctes:[],mdfes:[],rotas:[],programacoes:[],ocorrencias:[],sources:{viagens:true,pedidos:true,ctes:false,mdfes:false}
   }})};
  throw Error('Consulta inesperada '+url);
 };
 let prevented=false;
 events.submit({target:{id:'docsSyncForm'},preventDefault(){prevented=true;}});
 await new Promise(resolve=>setTimeout(resolve,10));
 assert(prevented);assert(count>=5,'Deve buscar documentos, pedidos e referências E/V/P');
 assert.deepEqual([...new Set(refQueries)].sort(),['E','P','V']);
 assert.equal(syncToken.value,'','Token não deve ficar no input');
 assert(root.innerHTML.includes('DSS SINCRONIZADO'));
 assert(!root.innerHTML.includes('autorizacao-temporaria-teste-2026'));
 nav('documentos');assert(root.innerHTML.includes('PARCEIRO TESTE'));
 nav('faturamento');assert(root.innerHTML.includes('DSS SINCRONIZADO'));
 nav('ctes');assert(root.innerHTML.includes('DSS SINCRONIZADO'));
 nav('clientes');assert(root.innerHTML.includes('DSS SINCRONIZADO'));
 nav('comparativos');assert(root.innerHTML.includes('COMPARATIVO INDEPENDENTE'));
 assert(root.innerHTML.includes('CONSULTAR COMPARATIVO NO DSS'));
 assert(!root.innerHTML.includes('DSS SINCRONIZADO'));
 nav('painel');assert(root.innerHTML.includes('RESUMO DE FATURAS'));
 nav('receber');
 assert(root.innerHTML.includes('REF-E'));
 assert(!root.innerHTML.includes('data-action="recv-consult"'));
 assert(root.innerHTML.includes('data-action="recv-report-xlsx"'));
 assert(root.innerHTML.includes('data-action="recv-report-csv"'));
 assert(root.innerHTML.includes('data-action="recv-report-pdf"'));
 const fetchedBeforeRefChange=count;
 events.change({target:{id:'recvRef',value:'V',dataset:{}}});
 assert(root.innerHTML.includes('REF-V'));
 assert(!root.innerHTML.includes('REF-E'));
 events.change({target:{id:'recvRef',value:'P',dataset:{}}});
 assert(root.innerHTML.includes('REF-P'));
 events.change({target:{id:'recvRef',value:'E',dataset:{}}});
 assert(root.innerHTML.includes('REF-E'));
 assert.equal(count,fetchedBeforeRefChange,'Troca E/V/P usa dados já sincronizados e não faz nova consulta');
 nav('painel');
 assert(!storage.has('docsSyncToken'));
 // Alterar período invalida a cópia real de TODAS as abas.
 events.change({target:{id:'to',value:'2026-10-18',dataset:{}}});
 assert(root.innerHTML.includes('DEMONSTRAÇÃO'));
 assert(!root.innerHTML.includes('DSS SINCRONIZADO'));
 nav('documentos');assert(!root.innerHTML.includes('PARCEIRO TESTE'));
});
test('Botão público não inclui URL com token nem liga o backend automaticamente',()=>{
 const cfg=readFileSync('src/site-config.mjs','utf8');
 assert.match(cfg,/export const API_BASE_URL = '';/);
 const app=readFileSync('src/app.js','utf8');
 assert(app.includes('function renderSearchBar()'));
 assert(app.includes('mergeOverviewResponses(results)'));
 assert(app.includes("state.mode='live'"));
 assert(app.includes('data-action="docs-sync-open"'));
 assert(!app.includes('localStorage.setItem("docsSyncToken"'));
});
