import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {summarizeOriginalReceivableFields} from '../api/receivables.mjs';

test('Diagnóstico confirma se o DSS entregou os campos brutos (apenas contagens)',()=>{
 const data=[
  {valorPagamento:0,valorResidual:null,valor:250,tipoFatura:'Transporte',parceiro:'CLIENTE PRIVADO'},
  {valorRecebido:'1.250,00',saldoResidual:0,valorParcela:1250,tipo_de_fatura:''},
  {situacaoFatura:'Pago',parceiro:'OUTRO CLIENTE PRIVADO'}
 ];
 const info=summarizeOriginalReceivableFields(data);
 assert.equal(info.total,3);
 assert.deepEqual(info.valorPagamento,{presente:2,ausente:1,zero:1,naoZero:1});
 assert.deepEqual(info.valorResidual,{presente:1,ausente:2,zero:1,naoZero:0});
 assert.deepEqual(info.tipoFatura,{presente:1,ausente:2,zero:0,naoZero:0});
 assert(!JSON.stringify(info).includes('PRIVADO'));
});
test('Não incluir API Contas a Pagar nesta alteração',()=>{
 for(const path of ['src/app.js','api/server.mjs','api/receivables.mjs']){
  const content=readFileSync(path,'utf8');
  assert(!content.includes('listarContasPagar'));
  assert(!content.includes('DSS_PAYABLES_PATH'));
 }
});