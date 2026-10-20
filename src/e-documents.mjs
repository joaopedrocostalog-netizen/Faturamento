/** Campos documentados pelo DSS para documentos eletrônicos (NFS-e etc.).
 * Compartilhado por frontend e backend; nenhuma credencial aqui. */
const t=v=>v===null||v===undefined?'':String(v).trim();
const money=v=>{
 if(v===null||v===undefined||v==='')return null;
 if(typeof v==='number')return Number.isFinite(v)?v:null;
 let s=t(v).replace(/[R$\s]/g,'');
 if(s.includes(',')&&s.includes('.'))s=s.replace(/\./g,'').replace(',','.');
 else if(s.includes(','))s=s.replace(',','.');
 const n=Number(s);return Number.isFinite(n)?n:null;
};
export function isoEmissionDate(v){
 const s=t(v),p=s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
 if(p)return validDate(p[3]+'-'+p[2]+'-'+p[1])?p[3]+'-'+p[2]+'-'+p[1]:'';
 const d=s.slice(0,10);return validDate(d)?d:'';
}
export function validDate(v){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(v||''))return false;
 const d=new Date(v+'T12:00:00Z');
 return !Number.isNaN(d.getTime())&&d.toISOString().slice(0,10)===v;
}
export const dateToDss=v=>v.slice(8,10)+'/'+v.slice(5,7)+'/'+v.slice(0,4);
export function normalizeElectronicDocuments(payload){
 if(!payload||typeof payload!=='object'||Array.isArray(payload))throw Error('Resposta de documentos eletrônicos inválida.');
 if(payload.status!==undefined&&Number(payload.status)!==200)throw Error('DSS: '+t(payload.mensagemErro||'Consulta recusada.').slice(0,180));
 if(!Array.isArray(payload.registros))throw Error('Resposta DSS sem lista de registros.');
 if(Number.isInteger(payload.qtd_registros)&&payload.qtd_registros>payload.registros.length)
  throw Error('DSS informou mais registros do que retornou; confira se existe paginação.');
 return payload.registros.map((row,i)=>{
  if(!row||typeof row!=='object'||Array.isArray(row))throw Error('Registro eletrônico inválido na posição '+i);
  return {
   id:row.id===undefined||row.id===null?'':String(row.id),
   parceiro:t(row.parceiro),tipoOperacao:t(row.tipo_operacao),numeroNfse:t(row.numero_nfse),
   modelo:t(row.modelo),status:t(row.status),dataEmissao:isoEmissionDate(row.data_emissao),
   dataEmissaoOriginal:t(row.data_emissao),valorFinal:money(row.valor_final),
   totalIss:money(row.total_iss),fatura:t(row.fatura),pontoApoio:t(row.ponto_apoio)
  };
 });
}
export function summaryElectronicDocuments(rows){
 const m=k=>{const valid=rows.filter(r=>Number.isFinite(r[k]));return {sum:valid.reduce((v,r)=>v+r[k],0),count:valid.length};};
 return {count:rows.length,withNfse:rows.filter(r=>r.numeroNfse).length,
  withFatura:rows.filter(r=>r.fatura).length,valorFinal:m('valorFinal'),totalIss:m('totalIss')};
}
/** Exemplos claramente fictícios; não representam documentos da COSTALOG. */
export const demoElectronicDocuments=Object.freeze([
 {id:1,parceiro:'CLIENTE EXEMPLO A',tipo_operacao:'Serviço de transporte',numero_nfse:'DEMO-1001',modelo:'NFS-e',status:'Emitida',data_emissao:'05/10/2026',valor_final:2350.75,total_iss:117.54,fatura:'DEMO-FAT-001',ponto_apoio:'Santos'},
 {id:2,parceiro:'CLIENTE EXEMPLO B',tipo_operacao:'Armazenagem',numero_nfse:'DEMO-1002',modelo:'NFS-e',status:'Pendente',data_emissao:'08/10/2026',valor_final:1800,total_iss:90,fatura:'DEMO-FAT-002',ponto_apoio:'Guarujá'},
 {id:3,parceiro:'CLIENTE EXEMPLO C',tipo_operacao:'Serviço de transporte',numero_nfse:'DEMO-1003',modelo:'NFS-e',status:'Cancelada',data_emissao:'11/10/2026',valor_final:750,total_iss:37.5,fatura:'',ponto_apoio:'Santos'}
]);
