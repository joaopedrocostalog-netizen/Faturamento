/** Campos documentados da DSS / Parcelas a Receber. Fonte única para front e backend. */
import {validDate} from './e-documents.mjs';
export const RECEIVABLE_FIELDS=Object.freeze({
 empresa:'Empresa',dataEmissao:'Emissão',parceiro:'Parceiro',cnpjCpfParceiro:'CNPJ/CPF do parceiro',
 parcela:'Parcela',fatura:'Fatura',nroDocumento:'Nº documento',historico:'Histórico',
 obsFatura:'Observações da fatura',tipoFatura:'Tipo de fatura',qtdDiasAberto:'Dias em aberto',
 situacaoFatura:'Situação da fatura',dataVencimento:'Vencimento',
 dataVencimentoOriginal:'Vencimento original',valor:'Valor da parcela',
 valorPagamento:'Valor do pagamento',metodoPagamento:'Método de pagamento',
 centroCusto:'Centro de custo',faturaCriadaPor:'Criada por',bordero:'Borderô',
 formaPagamento:'Forma de pagamento',lote:'Lote',dataPagamento:'Pagamento',
 valorDesconto:'Desconto',valorAcrescimo:'Acréscimo',diarioPagamento:'Diário de pagamento',
 valorResidual:'Saldo residual',cteFreteMunicipal:'CT-e/Frete municipal',
 conta:'Conta',codigoConta:'Código da conta',nomeConta:'Nome da conta',
 dataReferencia:'Data de referência',valorTotal:'Valor total'
 ,linhaDigitavel:'Linha digitável'
});
export const RECEIVABLE_NUMBERS=Object.freeze(['qtdDiasAberto','valor','valorPagamento','valorDesconto','valorAcrescimo','valorResidual','valorTotal']);
export const RECEIVABLE_DATES=Object.freeze(['dataEmissao','dataVencimento','dataVencimentoOriginal','dataPagamento','dataReferencia']);
const monetary=v=>{
 if(v===null||v===undefined||v==='')return null;
 if(typeof v==='number')return Number.isFinite(v)?v:null;
 let s=String(v).replace(/R\$|\s/g,'');
 if(s.includes('.')&&s.includes(','))s=s.replace(/\./g,'').replace(',','.');
 else if(s.includes(','))s=s.replace(',','.');
 const n=Number(s);return Number.isFinite(n)?n:null;
};
const iso=v=>{
 if(!v)return '';
 const s=String(v),pt=s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
 const result=pt?pt[3]+'-'+pt[2]+'-'+pt[1]:s.slice(0,10);
 return validDate(result)?result:'';
};
export function normalizeReceivables(payload){
 if(!payload||typeof payload!=='object'||Array.isArray(payload))throw Error('Formato de contas a receber inválido.');
 if(payload.status!==undefined&&Number(payload.status)!==200)throw Error('DSS: '+String(payload.mensagemErro||'Consulta recusada').slice(0,160));
 if(!Array.isArray(payload.registros))throw Error('Resposta sem registros de parcelas.');
 if(Number.isInteger(payload.qtd_registros)&&payload.qtd_registros>payload.registros.length)
  throw Error('O DSS informou mais parcelas que as recebidas. Verifique possível paginação.');
 return payload.registros.map((row,index)=>{
  if(!row||typeof row!=='object'||Array.isArray(row))throw Error('Parcela inválida na posição '+index);
  const out={};
  for(const key of Object.keys(RECEIVABLE_FIELDS)){
   const v=row[key];
   out[key]=RECEIVABLE_NUMBERS.includes(key)?monetary(v):
    RECEIVABLE_DATES.includes(key)?iso(v):v===null||v===undefined?'':String(v).trim();
  }
  return out;
 });
}
/** Não presumir que uma parcela foi paga somente por seu status textual. */
export function receivablesSummary(rows,{today=new Date().toISOString().slice(0,10)}={}){
 let face=0,paid=0,residual=0,faceKnown=0,paidKnown=0,residualKnown=0,lateCount=0,lateResidual=0,lateKnown=0,paidCount=0,openCount=0,partialCount=0;
 const groups={situacoes:new Map(),parceiros:new Map(),tipos:new Map(),vencimentos:new Map(),pagamentos:new Map()};
 for(const r of rows){
  if(Number.isFinite(r.valor)){face+=r.valor;faceKnown++;}
  if(Number.isFinite(r.valorPagamento)){paid+=r.valorPagamento;paidKnown++;}
  if(Number.isFinite(r.valorResidual)){residual+=r.valorResidual;residualKnown++;}
  if(r.dataPagamento)paidCount++;
  if(Number.isFinite(r.valorResidual)&&r.valorResidual>0)openCount++;
  if(r.dataPagamento&&Number.isFinite(r.valorResidual)&&r.valorResidual>0)partialCount++;
  if(r.dataVencimento&&r.dataVencimento<today&&Number.isFinite(r.valorResidual)&&r.valorResidual>0){lateCount++;lateResidual+=r.valorResidual;lateKnown++;}
  for(const [name,val] of [['situacoes',r.situacaoFatura],['parceiros',r.parceiro],['tipos',r.tipoFatura],['vencimentos',r.dataVencimento?.slice(0,7)],['pagamentos',r.formaPagamento||r.metodoPagamento]]){
   const key=String(val||'Não informado');const map=groups[name];
   const x=map.get(key)||{name:key,count:0,value:0,known:0};
   x.count++;if(Number.isFinite(r.valorResidual)){x.value+=r.valorResidual;x.known++;}map.set(key,x);
  }
 }
 const grouped=Object.fromEntries(Object.entries(groups).map(([key,map])=>[key,[...map.values()].sort((a,b)=>b.value-a.value||b.count-a.count)]));
 return {count:rows.length,face,faceKnown,paid,paidKnown,residual,residualKnown,
  paidCount,openCount,partialCount,lateCount,lateResidual,lateKnown,...grouped};
}