/** Parcelas a receber: tabela paginada, 34 campos em detalhes e gráficos leves, sem dependências. */
import {RECEIVABLE_FIELDS,RECEIVABLE_NUMBERS,RECEIVABLE_DATES,receivablesSummary} from './receivables.mjs';
const h=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const brl=x=>Number.isFinite(x)?new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(x):'—';
const num=x=>new Intl.NumberFormat('pt-BR').format(x);
const dt=x=>/^\d{4}-\d{2}-\d{2}$/.test(x||'')?x.slice(8)+'/'+x.slice(5,7)+'/'+x.slice(0,4):'—';
const memo=new WeakMap();
const groupColors=['#e33b57','#a5a7b1','#7c859d','#e0a052'];
const GROUPS={E:['Emissão','dataEmissao'],V:['Vencimento','dataVencimento'],P:['Pagamento (somente pagas)','dataPagamento']};
export function filteredReceivables(rows,state){
 const key=state.recvSortKey||'valor',dir=state.recvSortDir==='asc'?1:-1,q=String(state.recvSearch||'').toLowerCase().trim(),status=state.recvStatus||'';
 const group=GROUPS[state.recvRef||'E']||GROUPS.E,ds=group[1];
 const ck=[state.from,state.to,state.recvRef,key,dir,status,q].join('|');
 let c=memo.get(rows);if(!c){c=new Map();memo.set(rows,c);}if(c.has(ck))return c.get(ck);
 const filtered=rows.filter(row=>{
  const date=row[ds];if(date&&((state.from&&date<state.from)||(state.to&&date>state.to)))return false;
  if(status&&row.situacaoFatura!==status)return false;
  if(q&&!Object.values(row).some(value=>String(value??'').toLowerCase().includes(q)))return false;
  return true;
 }).sort((a,b)=>{
  const x=a[key],y=b[key];
  if(x===null||x===undefined||x==='')return y===null||y===undefined||y===''?0:1;
  if(y===null||y===undefined||y==='')return -1;
  if(RECEIVABLE_NUMBERS.includes(key))return (x-y)*dir;
  return String(x).localeCompare(String(y),'pt-BR',{numeric:true,sensitivity:'base'})*dir;
 });
 if(c.size>5)c.clear();c.set(ck,filtered);return filtered;
}
function barChart(title,rows,unit='money'){
 const entries=rows.slice(0,6),max=Math.max(0,...entries.map(x=>unit==='money'?x.value:x.count));
 return '<section class="mgmt-chart"><div class="mgmt-chart-head"><h3>'+h(title)+'</h3></div><div class="mgmt-bars">'+
 (entries.length?entries.map(e=>{
  const value=unit==='money'?e.value:e.count,width=max?Math.max(0,value/max*100):0;
  return '<div class="mgmt-bar-row"><div class="mgmt-bar-top"><span>'+h(e.name)+'</span><strong>'+h(unit==='money'?brl(value):num(value))+'</strong></div>'+
   '<div class="mgmt-bar-track"><div class="mgmt-bar-fill" style="width:'+Math.min(100,Math.max(0,width)).toFixed(1)+'%"></div></div><small>'+num(e.count)+' parcela(s)</small></div>';
 }).join(''):'<p class="ins-hint">Sem dados para este gráfico.</p>')+'</div></section>';
}
const card=(label,value,desc)=>'<article class="kpi"><div class="kpi-label">'+h(label)+'</div><div class="kpi-value">'+h(value)+'</div><div class="kpi-sub">'+h(desc)+'</div></article>';
export function renderReceivables(rows,state){
 const r=filteredReceivables(rows,state),summary=receivablesSummary(r);
 const ref=state.recvRef||'E',source=state.recvSource==='live'?'DSS':state.recvSource==='unavailable'?'Consulta indisponível':'Demonstração';
 const statuses=[...new Set(rows.map(x=>x.situacaoFatura).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
 const fields=Object.entries(RECEIVABLE_FIELDS),sortKeys=['valor','valorResidual','valorPagamento','dataEmissao','dataVencimento','dataPagamento','parceiro','fatura','situacaoFatura','qtdDiasAberto'];
 const order=sortKeys.map(k=>'<option value="'+k+'" '+((state.recvSortKey||'valor')===k?'selected':'')+'>'+h(RECEIVABLE_FIELDS[k])+'</option>').join('');
 const opts=statuses.map(x=>'<option value="'+h(x)+'" '+(state.recvStatus===x?'selected':'')+'>'+h(x)+'</option>').join('');
 const limit=25,pages=Math.max(1,Math.ceil(r.length/limit)),page=Math.min(Math.max(1,state.recvPage||1),pages),visible=r.slice((page-1)*limit,page*limit);
 const cols=['parceiro','fatura','parcela','situacaoFatura','dataEmissao','dataVencimento','dataPagamento','valor','valorPagamento','valorResidual'];
 const colsHtml=cols.map(k=>'<th>'+h(RECEIVABLE_FIELDS[k])+'</th>').join('')+'<th>Detalhes</th>';
 const body=visible.map((row,i)=>'<tr>'+cols.map(k=>'<td>'+h(RECEIVABLE_NUMBERS.includes(k)?brl(row[k]):RECEIVABLE_DATES.includes(k)?dt(row[k]):row[k]||'—')+'</td>').join('')+
 '<td><details class="recv-details"><summary>Ver campos</summary><div class="recv-details-grid">'+fields.map(([k,label])=>
 '<div><b>'+h(label)+'</b><span>'+h(RECEIVABLE_NUMBERS.includes(k)?(k==='qtdDiasAberto'?row[k]??'—':brl(row[k])):RECEIVABLE_DATES.includes(k)?dt(row[k]):row[k]||'—')+'</span></div>').join('')+
 '</div></details></td></tr>').join('');
 const warnings=state.recvError?'<div class="info-strip error">'+h(state.recvError)+'</div>':'';
 return '<section class="ins-module"><div class="section-title"><h2>CONTAS A RECEBER / PARCELAS</h2><span>'+h(source)+'</span></div>'+
 '<p class="ins-hint">A consulta considera '+h(GROUPS[ref][0].toLowerCase())+' no período selecionado. Selecione o referencial E / V / P para consultar emissão, vencimento ou pagamento. A opção P é exclusiva para parcelas pagas, conforme a documentação DSS.</p>'+
 warnings+
 '<div class="recv-toolbar"><label>Referência do período<select class="control" id="recvRef"><option value="E" '+(ref==='E'?'selected':'')+'>Emissão (E)</option><option value="V" '+(ref==='V'?'selected':'')+'>Vencimento (V)</option><option value="P" '+(ref==='P'?'selected':'')+'>Pagamento (P)</option></select></label>'+
 '<button class="btn btn-red" type="button" data-action="recv-consult" '+(state.recvLoading?'disabled':'')+'>'+(state.recvLoading?'CONSULTANDO DSS...':'CONSULTAR CONTAS A RECEBER NO DSS')+'</button>'+
 '<label>Situação<select class="control" id="recvStatus"><option value="">Todas</option>'+opts+'</select></label>'+
 '<label>Ordenar<select class="control" id="recvSortKey">'+order+'</select></label>'+
 '<label>Ordem<select class="control" id="recvSortDir"><option value="desc" '+(state.recvSortDir!=='asc'?'selected':'')+'>Maior / mais recente</option><option value="asc" '+(state.recvSortDir==='asc'?'selected':'')+'>Menor / mais antigo</option></select></label>'+
 '<button type="button" class="btn" data-action="recv-clear">Limpar filtros</button></div>'+
 '<div class="v-search-row"><div class="v-search-field"><input id="recvSearchInput" type="search" class="control full" autocomplete="off" placeholder="Pesquise parceiro, parcela, fatura, CNPJ, conta ou qualquer campo..." value="'+h(state.recvSearch||'')+'"></div></div>'+
 '<div class="kpis">'+card('PARCELAS',num(summary.count),'Registros após filtros')+
 card('VALOR DAS PARCELAS',summary.faceKnown?brl(summary.face):'—',num(summary.faceKnown)+' valores informados')+
 card('VALOR DE PAGAMENTOS',summary.paidKnown?brl(summary.paid):'—','Informado pelo DSS; não somar a recebíveis')+
 card('SALDO RESIDUAL',summary.residualKnown?brl(summary.residual):'—',num(summary.residualKnown)+' saldos informados')+
 card('PARCELAS COM RESIDUAL',num(summary.openCount),'Saldo residual informado maior que zero')+
 card('VENCIDAS COM SALDO',num(summary.lateCount),summary.lateKnown?brl(summary.lateResidual)+' de residual':'Com vencimento anterior a hoje')+'</div>'+
 '<div class="mgmt-chart-grid">'+barChart('Saldo residual por parceiro',summary.parceiros)+
 barChart('Saldo por situação da fatura',summary.situacoes)+barChart('Saldo por mês do vencimento',summary.vencimentos)+
 barChart('Parcelas por tipo de fatura',summary.tipos,'count')+'</div>'+
 '<p class="ins-hint">Aviso: vencidas com saldo é uma sinalização calculada pela data de vencimento e valor residual da API. Não significa protesto, cobrança formal ou inadimplência confirmada. A ausência de valores permanece “—”, não zero.</p>'+
 '<div class="ins-responsive-table recv-table"><table><thead><tr>'+colsHtml+'</tr></thead><tbody>'+
 (body||'<tr><td colspan="11">Nenhuma parcela encontrada para este período e filtros.</td></tr>')+'</tbody></table></div>'+
 '<div class="pagination"><span>'+num(r.length)+' parcelas · Página '+page+' de '+pages+' · 25 por página</span>'+
 '<div class="pagination-actions"><button class="btn btn-sm" type="button" data-action="recv-prev" '+(page<=1?'disabled':'')+'>Anterior</button>'+
 '<button class="btn btn-sm" type="button" data-action="recv-next" '+(page>=pages?'disabled':'')+'>Próxima</button></div></div>'+
 '<p class="ins-hint">Clique em “Ver campos” para visualizar os '+fields.length+' atributos da parcela, incluindo histórico, centro de custo, desconto, acréscimo, lote, borderô, conta, diário de pagamento e linha digitável.</p></section>';
}
export function renderReceivablesTokenDialog(state){
 return '<div class="overlay" data-action="recv-cancel-overlay"><div class="drawer docs-sync-drawer" role="dialog" aria-modal="true" aria-labelledby="recvTitle">'+
 '<div class="drawer-top"><h2 id="recvTitle">Consultar Contas a Receber</h2><button class="btn" type="button" data-action="recv-cancel">Fechar</button></div>'+
 '<p>Consulta somente leitura de parcelas do DSS. Referência: '+h(GROUPS[state.recvRef||'E'][0])+'. Período: '+h(state.from)+' a '+h(state.to)+'.</p>'+
 '<form id="receivablesSyncForm" autocomplete="off"><label for="receivablesSyncToken">Token privado de sincronização</label>'+
 '<input id="receivablesSyncToken" class="control full" type="password" autocomplete="off" spellcheck="false" minlength="12" required placeholder="Token privado do Render">'+
 '<p class="footer-note">O token não é salvo no navegador; somente esta consulta será atualizada.</p>'+
 '<div class="v-bottom-actions"><button class="btn btn-red" type="submit">Consultar parcelas</button>'+
 '<button class="btn" type="button" data-action="recv-cancel">Cancelar</button></div></form></div></div>';
}
