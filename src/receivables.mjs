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
// Chaves publicadas no Swagger podem aparecer em camelCase, PascalCase ou snake_case.
// Usar aliases explícitos e jamais transformar um zero informado pelo DSS em outro valor.
const canon=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9]/g,'').toLowerCase();
const aliases={
 empresa:['razaoSocialEmpresa'],dataEmissao:['emissao','dtEmissao'],
 parceiro:['nomeParceiro','razaoSocialParceiro'],cnpjCpfParceiro:['cpfCnpjParceiro','documentoParceiro'],
 parcela:['numeroParcela','nroParcela'],fatura:['numeroFatura','nroFatura'],
 nroDocumento:['numeroDocumento'],historico:['descricaoHistorico'],
 obsFatura:['observacaoFatura','observacoesFatura'],
 tipoFatura:['tipoDeFatura','descricaoTipoFatura','tipoFaturaDescricao','tipoDaFatura','tipo_fatura','tipofatura'],
 qtdDiasAberto:['diasAberto','diasEmAberto'],
 situacaoFatura:['statusFatura','situacao','situacao_da_fatura'],
 dataVencimento:['vencimento','dtVencimento'],
 dataVencimentoOriginal:['vencimentoOriginal','dtVencimentoOriginal'],
 valor:['valorParcela','valorDaParcela','valorNominalParcela'],
 valorPagamento:['valorPago','valorRecebido','valorBaixado','vlPagamento'],
 metodoPagamento:['meioPagamento'],
 centroCusto:['centroDeCusto'],faturaCriadaPor:['usuarioCriacao','criadoPor'],
 bordero:['numeroBordero','nroBordero'],formaPagamento:['modalidadePagamento'],
 dataPagamento:['dtPagamento','dataBaixa'],valorDesconto:['desconto'],
 valorAcrescimo:['acrescimo'],diarioPagamento:['diarioBaixa'],
 valorResidual:['saldoResidual','saldoDevedor','saldoEmAberto','valorEmAberto','valorPendente'],
 cteFreteMunicipal:['cteMunicipal','freteMunicipal'],
 codigoConta:['codConta'],nomeConta:['descricaoConta'],
 dataReferencia:['dtReferencia'],valorTotal:['valorTotalFatura'],linhaDigitavel:['linhaDigitavelBoleto']
};
const monetary=v=>{
 if(v===null||v===undefined||v==='')return null;
 if(typeof v==='number')return Number.isFinite(v)?v:null;
 let s=String(v).replace(/R\$|\s/g,'');
 if(s.includes('.')&&s.includes(',')){
  s=s.lastIndexOf(',')>s.lastIndexOf('.')?s.replace(/\./g,'').replace(',','.'):s.replace(/,/g,'');
 }else if(s.includes(','))s=s.replace(',','.');
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
  const lookup=new Map(Object.entries(row).map(([k,v])=>[canon(k),v]));
  const out={};
  for(const key of Object.keys(RECEIVABLE_FIELDS)){
   const choices=[key,...(aliases[key]||[])];
   let v;
   for(const name of choices){
    if(lookup.has(canon(name))){
     const candidate=lookup.get(canon(name));
     // Um campo vazio não deve bloquear aliases válidos. Zero é um valor explícito.
     if(candidate!==undefined&&candidate!==null&&candidate!==''){v=candidate;break;}
    }
   }
   out[key]=RECEIVABLE_NUMBERS.includes(key)?monetary(v):
    RECEIVABLE_DATES.includes(key)?iso(v):v===null||v===undefined?'':String(v).trim();
  }
  return out;
 });
}
const normalizeStatus=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
export function isPaidStatus(v){return /^(pago|paga|pagos|pagas|quitado|quitada|quitados|quitadas|liquidado|liquidada|recebido|recebida)$/.test(normalizeStatus(v));}
export function isOpenStatus(v){return /^(aberto|aberta|abertos|abertas|em aberto|pendente|pendentes|vencido|vencida|parcial|parcialmente pago|parcialmente paga)$/.test(normalizeStatus(v));}
export function receivablesSummary(rows,{today=new Date().toISOString().slice(0,10)}={}){
 let face=0,paid=0,residual=0,faceKnown=0,paidKnown=0,residualKnown=0;
 let lateCount=0,lateResidual=0,lateKnown=0,paidCount=0,openCount=0,partialCount=0;
 let paidWithoutAmount=0,openWithZeroResidual=0,missingTypes=0,missingResidual=0;
 let missingPaid=0,zeroPaid=0,positivePaid=0,missingFace=0,zeroResidual=0,positiveResidual=0;
 let dueSoonCount=0,dueSoonResidual=0,nominalOpen=0,nominalOpenKnown=0;
 let inferredPaidNominal=0,inferredPaidNominalKnown=0;
 const groups={situacoes:new Map(),parceiros:new Map(),tipos:new Map(),vencimentos:new Map(),
  pagamentos:new Map(),centros:new Map(),empresas:new Map()};
 const agingRanges=[
  {name:'A vencer',count:0,value:0,known:0,face:0,faceKnown:0},
  {name:'1–30 dias',count:0,value:0,known:0,face:0,faceKnown:0},
  {name:'31–60 dias',count:0,value:0,known:0,face:0,faceKnown:0},
  {name:'61–90 dias',count:0,value:0,known:0,face:0,faceKnown:0},
  {name:'Mais de 90 dias',count:0,value:0,known:0,face:0,faceKnown:0},
  {name:'Sem vencimento',count:0,value:0,known:0,face:0,faceKnown:0}
 ];
 const soonEnd=new Date(new Date(today+'T12:00:00Z').getTime()+7*86400000).toISOString().slice(0,10);
 for(const r of rows){
  const hasFace=Number.isFinite(r.valor),hasPaid=Number.isFinite(r.valorPagamento),
   hasResidual=Number.isFinite(r.valorResidual);
  const statusPaid=isPaidStatus(r.situacaoFatura),statusOpen=isOpenStatus(r.situacaoFatura);
  if(hasFace){face+=r.valor;faceKnown++;}else missingFace++;
  if(!hasPaid)missingPaid++;else if(r.valorPagamento===0)zeroPaid++;else if(r.valorPagamento>0)positivePaid++;
  if(hasResidual&&r.valorResidual===0)zeroResidual++;
  if(hasResidual&&r.valorResidual>0)positiveResidual++;
  if(hasPaid){paid+=r.valorPagamento;paidKnown++;}
  if(hasResidual){residual+=r.valorResidual;residualKnown++;}else missingResidual++;
  if(r.dataPagamento||statusPaid)paidCount++;
  if(hasResidual&&r.valorResidual>0)openCount++;
  if(r.dataPagamento&&hasResidual&&r.valorResidual>0)partialCount++;
  if(statusPaid&&(!hasPaid||r.valorPagamento===0)&&hasFace&&r.valor>0){paidWithoutAmount++;inferredPaidNominal+=r.valor;inferredPaidNominalKnown++;}
  if(statusOpen&&hasResidual&&r.valorResidual===0&&hasFace&&r.valor>0)openWithZeroResidual++;
  if(statusOpen&&hasFace){nominalOpen+=r.valor;nominalOpenKnown++;}
  if(!r.tipoFatura)missingTypes++;
  if(r.dataVencimento&&r.dataVencimento<today&&hasResidual&&r.valorResidual>0){lateCount++;lateResidual+=r.valorResidual;lateKnown++;}
  if(r.dataVencimento&&r.dataVencimento>=today&&r.dataVencimento<=soonEnd&&hasResidual&&r.valorResidual>0){
   dueSoonCount++;dueSoonResidual+=r.valorResidual;
  }
  let idx=5;
  if(r.dataVencimento){
   if(r.dataVencimento>=today)idx=0;
   else{
    const days=Math.max(1,Math.round((new Date(today+'T12:00:00Z')-new Date(r.dataVencimento+'T12:00:00Z'))/86400000));
    idx=days<=30?1:days<=60?2:days<=90?3:4;
   }
  }
  const aging=agingRanges[idx];aging.count++;
  if(hasResidual){aging.value+=r.valorResidual;aging.known++;}
  if(hasFace){aging.face+=r.valor;aging.faceKnown++;}
  for(const [name,val] of [['situacoes',r.situacaoFatura],['parceiros',r.parceiro],['tipos',r.tipoFatura],
    ['vencimentos',r.dataVencimento?.slice(0,7)],['pagamentos',r.formaPagamento||r.metodoPagamento],
    ['centros',r.centroCusto],['empresas',r.empresa]]){
   const key=String(val||'Não informado pelo DSS'),map=groups[name];
   const x=map.get(key)||{name:key,count:0,value:0,known:0,face:0,faceKnown:0,paid:0,paidKnown:0};
   x.count++;
   if(hasResidual){x.value+=r.valorResidual;x.known++;}
   if(hasFace){x.face+=r.valor;x.faceKnown++;}
   if(hasPaid){x.paid+=r.valorPagamento;x.paidKnown++;}
   map.set(key,x);
  }
 }
 const grouped=Object.fromEntries(Object.entries(groups).map(([key,map])=>[key,[...map.values()].sort((a,b)=>b.value-a.value||b.face-a.face||b.count-a.count)]));
 return {count:rows.length,face,faceKnown,paid,paidKnown,residual,residualKnown,
  paidCount,openCount,partialCount,lateCount,lateResidual,lateKnown,dueSoonCount,dueSoonResidual,
  paidWithoutAmount,openWithZeroResidual,missingTypes,missingResidual,
  missingPaid,zeroPaid,positivePaid,missingFace,zeroResidual,positiveResidual,
  nominalOpen,nominalOpenKnown,inferredPaidNominal,inferredPaidNominalKnown,
  paymentFieldCoverage:{filled:paidKnown,missing:missingPaid,zero:zeroPaid,positive:positivePaid},
  residualFieldCoverage:{filled:residualKnown,missing:missingResidual,zero:zeroResidual,positive:positiveResidual},
  aging:agingRanges,...grouped};
}
