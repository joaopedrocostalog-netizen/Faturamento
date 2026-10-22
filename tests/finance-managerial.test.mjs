import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {managerialMetrics,renderManagerialDashboard} from '../src/managerial-ui.mjs';
import {filteredElectronicDocuments,renderElectronicDocuments} from '../src/e-documents-ui.mjs';
import {normalizeElectronicDocuments} from '../src/e-documents.mjs';

const rows=normalizeElectronicDocuments({status:200,registros:[
 {id:11,parceiro:'Parceiro A',tipo_operacao:'Transporte',numero_nfse:'123',modelo:'NFS-e',status:'Emitida',data_emissao:'01/09/2026',valor_final:300,total_iss:15,fatura:'F-3',ponto_apoio:'Santos'},
 {id:12,parceiro:'Parceiro B',tipo_operacao:'Armazenagem',numero_nfse:'',modelo:'NFS-e',status:'Pendente',data_emissao:'02/09/2026',valor_final:100,total_iss:5,fatura:'',ponto_apoio:'Guarujá'},
 {id:13,parceiro:'Parceiro A',tipo_operacao:'Transporte',numero_nfse:'124',modelo:'NFS-e',status:'Emitida',data_emissao:'03/10/2026',valor_final:null,total_iss:null,fatura:'',ponto_apoio:'Santos'}
]});
test('A visão gerencial utiliza os 11 campos documentados e não contabiliza ausentes como zero',()=>{
 const metrics=managerialMetrics(rows,[]);
 assert.equal(metrics.count,3);
 assert.equal(metrics.knownFinal,2);
 assert.equal(metrics.valorFinal,400);
 assert.equal(metrics.iss,20);
 assert.equal(metrics.knownIss,2);
 assert.equal(metrics.withNfse,2);
 assert.equal(metrics.withFatura,1);
 assert.equal(metrics.operacoes.find(x=>x.name==='Transporte').count,2);
 assert.equal(metrics.apoios.find(x=>x.name==='Santos').count,2);
 assert.equal(metrics.parceiros.find(x=>x.name==='Parceiro A').count,2);
 assert.equal(metrics.meses.length,2);
 assert.strictEqual(managerialMetrics(rows,[]).valorFinal,400);
 const h=renderManagerialDashboard(rows,[],{docsSource:'live'});
 for(const label of ['VISÃO GERENCIAL DSS','Valor por tipo de operação','Principais parceiros','Documentos por situação','Documentos por modelo','Ponto de apoio','EVOLUÇÃO','COBERTURA DOS CAMPOS DA API'])assert(h.toUpperCase().includes(label.toUpperCase()),label);
 assert(h.includes('valor recebido')&&h.includes('Não somar automaticamente'), 'A tela deve avisar que NFS-e não é pagamento recebido');
 assert(!h.includes('<script>'));
});
test('Documentos filtram tipo de operação e ponto de apoio, com ID e paginação',()=>{
 assert.equal(filteredElectronicDocuments(rows,{docsOperation:'Transporte'}).length,2);
 assert.equal(filteredElectronicDocuments(rows,{docsSupport:'Santos'}).length,2);
 assert.equal(filteredElectronicDocuments(rows,{docsOperation:'Armazenagem',docsSupport:'Santos'}).length,0);
 const h=renderElectronicDocuments(rows,{from:'2026-01-01',to:'2026-10-20',docsSource:'live'});
 for(const id of ['docsOperation','docsSupport','data-doc-sort="id"','ID DSS'])assert(h.includes(id),id);
 assert.equal((h.match(/<tbody>/g)||[]).length,1);
});
test('A tela gerencial está disponível para todos os perfis existentes no portal',async()=>{
 const {permittedView}=await import('../src/access-ui.mjs');
 assert(permittedView('financeiro','gerencial'));
 assert(permittedView('administrador','gerencial'));
 const app=readFileSync('src/app.js','utf8');
 assert(app.includes("['gerencial','chart','Visão Gerencial']"));
 assert(app.includes('renderManagerialDashboard(docs.rows,d.pedidos,scopedState)'));
});
