import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {loadReceivableReferences,referenceSelection,RECEIVABLE_REFERENCES} from '../src/receivables-references.mjs';
import {receivablesReport,receivablesCsv} from '../src/receivables-report.mjs';
import {normalizeReceivables} from '../src/receivables.mjs';
import {renderReceivables} from '../src/receivables-ui.mjs';
test('Um token e uma sincronização preparam referências E, V e P independentemente',async()=>{
 const used=[],token='TOKEN_APENAS_EM_MEMORIA';
 const cache=await loadReceivableReferences({
  token,from:'2026-10-01',to:'2026-10-21',
  load:async({token:secret,from,to,tipoRef})=>{
   assert.equal(secret,token);assert.equal(from,'2026-10-01');assert.equal(to,'2026-10-21');
   used.push(tipoRef);return [{fatura:'TEST-'+tipoRef}];
  }
 });
 assert.deepEqual([...used].sort(),[...RECEIVABLE_REFERENCES].sort());
 for(const r of RECEIVABLE_REFERENCES){
  const selection=referenceSelection(cache,r);
  assert.equal(selection.source,'live');
  assert.equal(selection.rows[0].fatura,'TEST-'+r);
 }
 assert(!JSON.stringify(cache).includes(token));
 assert.notStrictEqual(referenceSelection(cache,'E').rows,referenceSelection(cache,'P').rows);
});
test('Falha de vencimento não reaproveita registros de emissão ou pagamento',async()=>{
 const cache=await loadReceivableReferences({token:'x',from:'2026-10-01',to:'2026-10-21',
  load:async({tipoRef})=>{
   if(tipoRef==='V')throw Error('Timeout no DSS');
   return [{fatura:tipoRef}];
  }
 });
 assert.equal(referenceSelection(cache,'E').source,'live');
 assert.equal(referenceSelection(cache,'P').source,'live');
 const failed=referenceSelection(cache,'V');
 assert.equal(failed.source,'unavailable');
 assert.deepEqual(failed.rows,[]);
 assert.match(failed.error,/Timeout no DSS/);
 assert.equal(referenceSelection(null,'P').source,'pending');
 assert.throws(()=>referenceSelection(cache,'X'),/inválida/);
});
const rows=normalizeReceivables({status:200,registros:Array.from({length:55},(_,i)=>({
 empresa:i%2?'CRC COSTA':'IDEALLOG',parceiro:i===0?'=MALICIOUS()':'Cliente '+i,
 fatura:'F-'+i,parcela:'1/1',dataVencimento:'2026-10-20',situacaoFatura:i%2?'Pago':'Aberto',
 valor:i+1,valorPagamento:i%2?i+1:0,valorResidual:i%2?0:i+1,
 linhaDigitavel:'123 456'
}))});
test('Exportação respeita filtro de empresa, pesquisa e não limita a 25 linhas',()=>{
 const opts={recvCompany:'all',recvSource:'live',recvSortKey:'valor',recvSortDir:'desc',
 recvQuick:'todos',recvStatus:'',recvSearch:''};
 const report=receivablesReport(rows,opts);
 assert.equal(report.count,55);
 assert.equal(report.rows.length,55);
 assert(report.columns.some(x=>x[0]==='linhaDigitavel'));
 assert.equal(report.rows[0].valor,55);
 const custom=receivablesReport(rows,{...opts,recvCompany:'CRC COSTA',recvSearch:'Cliente'});
 assert.equal(custom.count,28);
 assert(custom.rows.every(x=>x.empresa==='CRC COSTA'));
 const printable=receivablesReport(rows,opts,{compact:true});
 assert(printable.columns.length<report.columns.length);
 assert.equal(printable.rows.length,55);
 assert(printable.columns.some(x=>x[0]==='valorResidual'));
});
test('CSV contém BOM, rótulos amigáveis e neutraliza injeção de fórmulas',()=>{
 const report=receivablesReport(rows,{recvCompany:'all',recvSource:'live'});
 const csv=receivablesCsv(report);
 assert(csv.startsWith('\uFEFF'));
 assert(csv.includes('Valor do pagamento'));
 assert(csv.includes("'=MALICIOUS()"));
 assert(csv.includes('55'));
});
test('Botão individual removido, relatórios disponíveis após sincronizar',()=>{
 const html=renderReceivables(rows,{recvRef:'E',recvSource:'live',recvCompany:'all'});
 assert(!html.includes('data-action="recv-consult"'));
 for(const id of ['recv-report-xlsx','recv-report-csv','recv-report-pdf'])
  assert(html.includes('data-action="'+id+'"'));
 const before=renderReceivables([],{
  recvRef:'V',recvSource:'pending',recvCompany:'all',recvRows:[]});
 assert(before.includes('Sincronizar com DSS'));
 assert(!before.includes('recv-report-xlsx'));
 assert(!before.includes('PARCELAS</div>'));
});
test('As duas distribuições temporais não devem ser somadas no Painel',()=>{
 const app=readFileSync('src/app.js','utf8');
 assert(app.includes('loadReceivableReferences({token,from,to'));
 assert(app.includes('state.recvReferenceCache=receivables'));
 assert(app.includes('referenceSelection(state.recvReferenceCache,state.recvRef)'));
 assert(!app.includes("if(action==='recv-consult'"));
 assert(!app.includes("if(e.target?.id==='receivablesSyncForm')"));
 assert(!app.includes('localStorage.setItem("recv'));
 const backend=readFileSync('api/server.mjs','utf8');
 const deploy=readFileSync('.github/workflows/pages.yml','utf8');
 for(const file of ['receivables-references.mjs','receivables-report.mjs']){
  assert(backend.includes("'"+file+"'"));
  assert(deploy.includes('src/'+file));
 }
});
