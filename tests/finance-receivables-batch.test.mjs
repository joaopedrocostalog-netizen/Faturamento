import test from 'node:test';
import assert from 'node:assert/strict';
import {receivableWindows,loadReceivablesByPeriod} from '../src/receivables-batch.mjs';
import {queryReceivables} from '../api/receivables.mjs';

test('Um ano é dividido em 12 consultas mensais sem datas repetidas',()=>{
 const periods=receivableWindows('2026-01-01','2026-12-31');
 assert.equal(periods.length,12);
 assert.deepEqual(periods[0],{from:'2026-01-01',to:'2026-01-31'});
 assert.deepEqual(periods.at(-1),{from:'2026-12-01',to:'2026-12-31'});
 const custom=receivableWindows('2026-01-19','2026-03-05');
 assert.deepEqual(custom,[
  {from:'2026-01-19',to:'2026-01-31'},
  {from:'2026-02-01',to:'2026-02-28'},
  {from:'2026-03-01',to:'2026-03-05'}
 ]);
});
test('Resultados anuais são reunidos após todas as consultas; progresso correto e limitado',async()=>{
 const started=[],progress=[];let active=0,max=0;
 const result=await loadReceivablesByPeriod({
  token:'TOKEN-EXEMPLO-123456',from:'2026-01-01',to:'2026-12-31',tipoRef:'V',
  fetchPage:async({from,to,tipoRef})=>{
   assert.equal(tipoRef,'V');
   active++;max=Math.max(active,max);started.push([from,to]);
   await new Promise(resolve=>setTimeout(resolve,1));
   active--;
   return [{dataVencimento:to,fatura:'fatura-'+from}];
  },onProgress:(done,total,period)=>progress.push({done,total,period}),concurrency:1
 });
 assert.equal(max,1);
 assert.equal(started.length,12);
 assert.equal(progress.at(-1).done,12);
 assert.equal(progress.at(-1).total,12);
 assert.equal(result.length,12);
 assert(result[0].fatura.endsWith('2026-01-01'));
 assert(result.at(-1).fatura.endsWith('2026-12-01'));
});
test('Timeout mensal reparte em duas quinzenas e não inclui resultados parciais',async()=>{
 const received=[];
 const result=await loadReceivablesByPeriod({
  token:'TOKEN-EXEMPLO-123456',from:'2026-01-01',to:'2026-01-31',
  fetchPage:async p=>{
   received.push([p.from,p.to]);
   if(p.from==='2026-01-01'&&p.to==='2026-01-31')throw new Error('Tempo limite de 55s; tente período menor.');
   return [{fatura:p.from+'-'+p.to}];
  }
 });
 assert.deepEqual(received,[
  ['2026-01-01','2026-01-31'],
  ['2026-01-01','2026-01-16'],
  ['2026-01-17','2026-01-31']
 ]);
 assert.equal(result.length,2);
});
test('Não considera sincronização concluída se um mês falhar e preserva a causa e o intervalo',async()=>{
 const received=[];
 await assert.rejects(()=>loadReceivablesByPeriod({
  token:'TOKEN-EXEMPLO-123456',from:'2026-01-01',to:'2026-02-28',
  onProgress:(n)=>received.push(n),
  fetchPage:async p=>{
   if(p.from==='2026-02-01')throw new Error('A conexão com o DSS foi recusada.');
   return [{fatura:'ok'}];
  }
 }),/2026-02-01 a 2026-02-28.*conexão/i);
 assert.deepEqual(received,[1]);
});
test('Backend distingue timeout de DNS/recusa, com parâmetro DSS_RECEIVABLES_TIMEOUT_MS',async()=>{
 const env={DSS_BASE_URL:'https://dss.example.test/wsdss',
 DSS_RECEIVABLES_PATH:'/listarContasReceber',DSS_AUTH_TYPE:'basic',
 DSS_USERNAME:'teste',DSS_PASSWORD:'segredo-ficticio',DSS_RECEIVABLES_TIMEOUT_MS:'55000'};
 const onError=async(error,causePattern,status)=>{
  await assert.rejects(()=>queryReceivables({env,from:'2026-01-01',to:'2026-01-31',
   fetchImpl:async()=>{throw error;}}),e=>e.status===status&&causePattern.test(e.message));
 };
 await onError(Object.assign(new Error('The operation was aborted due to timeout'),{name:'TimeoutError'}),/Tempo limite de 55s/,504);
 await onError(Object.assign(new Error('fetch failed'),{cause:{code:'ENOTFOUND'}}),/DNS/,502);
 await onError(Object.assign(new Error('fetch failed'),{cause:{code:'ECONNREFUSED'}}),/interrompida ou recusada/,502);
});
