import test from 'node:test';
import assert from 'node:assert/strict';

test('Consulta separada do Comparativo mantém períodos A e B quando o site é sincronizado',async()=>{
 const events={},store=new Map(),root={innerHTML:'',addEventListener(n,fn){events[n]=fn;}};
 const tokenA={value:'token-temporario-de-comparativo-123456',focus(){}};
 const tokenSite={value:'token-temporario-de-sincronizacao-987654',focus(){}};
 globalThis.localStorage={getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)};
 globalThis.window={location:{hostname:'empresa.github.io',protocol:'https:',origin:'https://empresa.github.io'}};
 globalThis.document={getElementById:id=>id==='app'?root:id==='comparisonSyncToken'?tokenA:id==='docsSyncToken'?tokenSite:null,addEventListener(){},visibilityState:'visible'};
 globalThis.alert=()=>{};
 globalThis.confirm=()=>true;
 globalThis.fetch=async()=>{throw Error('O DSS não deve ser consultado na abertura do site.');};
 await import('../src/app.js?comparison-isolated=1');
 const nav=name=>events.click({target:{closest:q=>q==='[data-nav]'?{dataset:{nav:name}}:null}});
 const ins=key=>events.click({target:{closest:q=>q==='[data-ins-action]'?{dataset:{insAction:key}}:null}});
 const action=key=>events.click({target:{dataset:{},closest:q=>q==='[data-action]'?{dataset:{action:key}}:null}});
 const change=(id,value)=>events.change({target:{id,value,dataset:{}}});
 const submit=id=>events.submit({target:{id},preventDefault(){}});
 nav('comparativos');
 assert(root.innerHTML.includes('CONSULTAR COMPARATIVO NO DSS'));
 assert(!root.innerHTML.includes('COMPARATIVO DE FATURAMENTO</td>'));
 change('compareCurrentFrom','2026-09-01');
 change('compareCurrentTo','2026-09-30');
 change('comparePreviousFrom','2026-08-01');
 change('comparePreviousTo','2026-08-31');
 assert(root.innerHTML.includes('value="2026-09-01"'));
 assert(root.innerHTML.includes('value="2026-08-01"'));
 const compares=[];
 const payload=(from)=>({data:{viagens:[],pedidos:[{
  pf_id:from==='2026-09-01'?901:801,nro_pf:from==='2026-09-01'?'A-901':'B-801',
  data_emissao:from,total_frete_pedido_frete:from==='2026-09-01'?1500:1000
 }],ctes:[],mdfes:[],rotas:[],programacoes:[],ocorrencias:[],sources:{viagens:true,pedidos:true,ctes:false,mdfes:false}}});
 globalThis.fetch=async(url,opts)=>{
  assert(url.startsWith('https://faturamento-sq74.onrender.com/api/'));
  assert(opts.headers.Authorization.startsWith('Bearer token-temporario-de-'));
  const parsed=new URL(url),from=parsed.searchParams.get('from');
  if(parsed.pathname==='/api/overview'){compares.push(from);return {status:200,ok:true,json:async()=>payload(from)};}
  if(parsed.pathname==='/api/documentos-eletronicos')return {status:200,ok:true,json:async()=>({registros:[]})};
  throw Error('Rota inesperada: '+parsed.pathname);
 };
 ins('load-comparison');
 assert(root.innerHTML.includes('id="comparisonSyncForm"'));
 assert(root.innerHTML.includes('value="2026-09-01"'));
 assert(root.innerHTML.includes('value="2026-08-01"'));
 submit('comparisonSyncForm');
 await new Promise(r=>setTimeout(r,20));
 assert.equal(tokenA.value,'','Token da comparação deve ser apagado após uso');
 assert.deepEqual(compares.sort(),['2026-08-01','2026-09-01']);
 assert(root.innerHTML.includes('Fretes informados'));
 assert(root.innerHTML.includes('Resultado real do DSS'));
 assert(root.innerHTML.includes('value="2026-09-01"'));
 assert(root.innerHTML.includes('value="2026-08-01"'));
 // Alterar as datas do filtro global NÃO pode alterar o Comparativo.
 change('from','2026-10-01');
 assert(root.innerHTML.includes('value="2026-09-01"'));
 assert(root.innerHTML.includes('value="2026-08-01"'));
 assert(root.innerHTML.includes('Resultado real do DSS'));
 // Sincronizar o restante do site NÃO dispara outra consulta do Comparativo nem troca suas datas.
 const before=compares.filter(x=>['2026-08-01','2026-09-01'].includes(x)).length;
 action('docs-sync-open');
 assert(root.innerHTML.includes('id="docsSyncForm"'));
 submit('docsSyncForm');
 await new Promise(r=>setTimeout(r,30));
 assert.equal(tokenSite.value,'');
 assert(root.innerHTML.includes('COMPARATIVO INDEPENDENTE'));
 assert(root.innerHTML.includes('value="2026-09-01"'));
 assert(root.innerHTML.includes('value="2026-08-01"'));
 assert(root.innerHTML.includes('Resultado real do DSS'));
 assert.equal(compares.filter(x=>['2026-08-01','2026-09-01'].includes(x)).length,before);
 assert(!store.has('comparisonSyncToken'));
});
