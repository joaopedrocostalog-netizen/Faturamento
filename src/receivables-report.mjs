/** Exportação de todas as parcelas filtradas, não apenas página atual.
 * Mesma seleção/ordenação da tabela, sem persistir dados ou credenciais.
 */
import {RECEIVABLE_FIELDS,RECEIVABLE_DATES} from './receivables.mjs';
import {filteredReceivables} from './receivables-ui.mjs';
const fmtDate=x=>/^\d{4}-\d{2}-\d{2}$/.test(x||'')?x.slice(8,10)+'/'+x.slice(5,7)+'/'+x.slice(0,4):x||'';
const DISPLAY_COLUMNS=['empresa','parceiro','fatura','parcela','nroDocumento',
 'situacaoFatura','tipoFatura','dataEmissao','dataVencimento','valor',
 'valorPagamento','valorResidual','dataPagamento','centroCusto'];
const selectedColumns=compact=>compact?DISPLAY_COLUMNS:Object.keys(RECEIVABLE_FIELDS);
export function receivablesReport(rows,state,{compact=false}={}){
 const all=filteredReceivables(rows,state),keys=selectedColumns(compact);
 return {
  title:compact?'Contas a Receber - Resumo':'Contas a Receber - Parcelas',
  columns:keys.map(k=>[k,RECEIVABLE_FIELDS[k]]),
  rows:all.map(row=>Object.fromEntries(keys.map(key=>[
   key,RECEIVABLE_DATES.includes(key)?fmtDate(row[key]):row[key]??''
  ]))),
  count:all.length
 };
}
export function receivablesCsv(report){
 const quote=value=>{
  let txt=String(value??'');
  // Evita que valores digitados por terceiros sejam interpretados como fórmulas no Excel.
  if(/^[\s]*[=+@-]/.test(txt)&&!/^-\d+(?:[.,]\d+)?$/.test(txt.trim()))txt="'"+txt;
  return '"'+txt.replace(/"/g,'""')+'"';
 };
 const lines=[report.columns.map(x=>x[1]),...report.rows.map(row=>report.columns.map(c=>row[c[0]]??''))];
 return '\uFEFF'+lines.map(row=>row.map(quote).join(';')).join('\r\n');
}
