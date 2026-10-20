/** COSTALOG Financeiro — apresenta somente indicadores e registros de faturamento. */
import {buildInsights} from './operational.mjs';
import {receivablesSummary} from './receivables.mjs';
import {renderAdvanced} from './advanced-ui.mjs';
import {SHOW_FINANCE_ONLY_TABS} from './access-ui.mjs';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=v=>Number.isFinite(v)?new Intl.NumberFormat('pt-BR').format(v):'—';
const brl=v=>Number.isFinite(v)?new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v):'—';
const date=s=>/^\d{4}-\d{2}-\d{2}$/.test(s||'')?s.slice(8)+'/'+s.slice(5,7)+'/'+s.slice(0,4):'—';
const card=(name,value,info)=>'<article class="kpi"><div class="kpi-label">'+esc(name)+'</div><div class="kpi-value">'+esc(value)+'</div><div class="kpi-sub">'+esc(info)+'</div></article>';
export function renderFinanceDashboard(data,state){
 const insights=buildInsights(data,{year:Number((state.from||'').slice(0,4)||new Date().getFullYear())});
 const t=insights.totals;
 const withInvoice=(data.pedidos||[]).filter(p=>String(p.numeroFatura||'').trim()).length;
 const financial=state.recvSource==='live'?receivablesSummary(state.recvRows||[]):null;
 return '<section class="ins-module"><div class="section-title"><h2>RESUMO DE FATURAMENTO</h2><span>Fonte: '+(state.mode==='live'?'DSS':'dados de demonstração')+'</span></div>'+
 '<div class="kpis">'+
 card('FRETES INFORMADOS',brl(t.freight.known?t.freight.sum:null),'Valor dos pedidos; não é pagamento recebido')+
 card('PEDIDOS DE FRETE',num(t.orders),'Registros no intervalo selecionado')+
 card('LIBERADOS PARA FATURAR',num(t.readyToInvoice),'Situação informada pela DSS')+
 card('LIBERADOS SEM FATURA',num(t.withoutInvoice),'Requer conferência do número da fatura')+
 card('COM Nº DE FATURA',num(withInvoice),'Não comprova emissão ou recebimento')+
 card('TICKET MÉDIO',brl(t.freight.known?t.freight.sum/t.freight.known:null),'Somente pedidos com valores preenchidos')+
 (financial?card('SALDO RESIDUAL A RECEBER',financial.residualKnown?brl(financial.residual):'—','Parcelas DSS (referência: '+(state.recvRef==='E'?'emissão':state.recvRef==='V'?'vencimento':'pagamento')+')'):'')+
 (financial?card('PARCELAS COM VENCIMENTO PASSADO',num(financial.lateCount),'Com residual positivo e vencimento anterior a hoje'):'')+
 '</div><div class="v-bottom-actions"><button class="btn btn-red" data-nav="gerencial">VISÃO GERENCIAL E GRÁFICOS →</button><button class="btn" data-nav="receber">CONTAS A RECEBER →</button><button class="btn" data-nav="faturamento">CONTROLE DE FATURAMENTO →</button><button class="btn" data-nav="clientes">CLIENTES & FRETES ↗</button>'+ (SHOW_FINANCE_ONLY_TABS ? '<button class="btn" data-nav="relatorios">EXPORTAR RELATÓRIOS ↗</button>' : '')+'</div></section>'+
 (SHOW_FINANCE_ONLY_TABS ? renderAdvanced('analises',data,{...state,search:''}) : '');
}
const comparisons=d=>{const t=buildInsights(d).totals;return [
 {label:'Pedidos de frete',value:t.orders},
 {label:'CT-e identificados',value:t.ctes},
 {label:'Fretes informados',value:t.freight.known?t.freight.sum:null,money:true},
 {label:'Liberados para faturamento',value:t.readyToInvoice},
 {label:'Liberados sem nº de fatura',value:t.withoutInvoice},
 {label:'Averbações registradas',value:t.insured},
 {label:'Valor de averbação',value:t.averbacao.known?t.averbacao.sum:null,money:true}
];};
export function renderFinanceComparison(data,state){
 const current={from:state.compareCurrentFrom,to:state.compareCurrentTo};
 const previous={from:state.comparePreviousFrom,to:state.comparePreviousTo};
 // Comparativo independente: não herdar ou recalcular usando a sincronização global.
 const c=state.comparison;
 const ready=c&&c.currentRange?.from===current.from&&c.currentRange?.to===current.to&&c.previousRange?.from===previous.from&&c.previousRange?.to===previous.to;
 const left=ready?comparisons(c.current):[],right=ready?comparisons(c.previous):[];
 const lines=left.map((m,i)=>{
   const prev=right[i].value,delta=m.value===null||prev===null?null:m.value-prev;
   const percent=delta!==null&&prev!==0?delta/Math.abs(prev)*100:null;
   const fmt=m.money?brl:num;
   return '<tr><td>'+esc(m.label)+'</td><td>'+esc(fmt(m.value))+'</td><td>'+esc(fmt(prev))+'</td><td>'+esc(fmt(delta))+'</td><td>'+esc(percent===null?'—':percent.toFixed(1).replace('.',',')+'%')+'</td></tr>';
 }).join('');
 return '<section class="ins-module"><div class="ins-toolbar"><div><h2>COMPARATIVO DE FATURAMENTO</h2><p>Consulte dois períodos diretamente no DSS, independentemente das datas do restante do site.</p></div></div>'+
 '<div class="ins-compare-anchor"><label>Período A: de <input type="date" id="compareCurrentFrom" value="'+esc(current.from)+'"></label><label>Até <input type="date" id="compareCurrentTo" value="'+esc(current.to)+'"></label><label>Período B: de <input type="date" id="comparePreviousFrom" value="'+esc(previous.from)+'"></label><label>Até <input type="date" id="comparePreviousTo" value="'+esc(previous.to)+'"></label></div>'+
 '<div class="ins-period-label"><div><small>PERÍODO A</small><strong>'+esc(date(current.from))+' a '+esc(date(current.to))+'</strong></div><div><small>PERÍODO B</small><strong>'+esc(date(previous.from))+' a '+esc(date(previous.to))+'</strong></div></div>'+
 '<div class="ins-compare-actions"><button type="button" class="btn btn-red" data-ins-action="load-comparison" '+(state.comparisonLoading?'disabled':'')+'>'+(state.comparisonLoading?'CONSULTANDO COMPARATIVO...':'CONSULTAR COMPARATIVO NO DSS')+'</button>'+
 '<span>Consulta exclusiva do Comparativo. Não modifica o período global nem as outras abas.</span></div>'+
 (!ready&&!state.comparisonLoading?'<div class="ins-compare-init"><p>Selecione as datas dos períodos A e B e clique em CONSULTAR COMPARATIVO NO DSS. Os períodos podem ser diferentes do intervalo do Painel.</p></div>':'')+
 (ready?'<p class="ins-hint">Resultado real do DSS somente para os dois períodos selecionados.</p>':'')+
 (state.comparisonLoading?'<p class="ins-hint">Consultando os dois períodos no DSS; o restante do site não será alterado.</p>':'')+(state.comparisonError?'<p class="ins-inline-error">'+esc(state.comparisonError)+'</p>':'')+
 (ready?'<div class="ins-responsive-table"><table><thead><tr><th>Indicador</th><th>Período A</th><th>Período B</th><th>Diferença</th><th>Variação</th></tr></thead><tbody>'+lines+'</tbody></table></div>':'')+
 '<p class="ins-hint">Frete informado não comprova recebimento. Valores ausentes não são tratados como zero; variações com base zero não são calculadas.</p></section>';
}
/** Autorização exclusiva do comparativo; token sem persistência no navegador. */
export function renderComparisonSyncDialog(state){
 return '<div class="overlay" data-action="comparison-sync-backdrop">'+
 '<div class="drawer docs-sync-drawer" role="dialog" aria-modal="true" aria-labelledby="comparisonSyncTitle">'+
 '<div class="drawer-top"><h2 id="comparisonSyncTitle">Consultar comparativo no DSS</h2>'+
 '<button type="button" class="btn" data-action="comparison-sync-cancel">Fechar</button></div>'+
 '<p>Atualiza somente o Comparativo, sem modificar o Painel, as notas fiscais, os pedidos ou o período global.</p>'+
 '<p>Período A: '+esc(date(state.compareCurrentFrom))+' a '+esc(date(state.compareCurrentTo))+'</p>'+
 '<p>Período B: '+esc(date(state.comparePreviousFrom))+' a '+esc(date(state.comparePreviousTo))+'</p>'+
 '<form id="comparisonSyncForm" autocomplete="off">'+
 '<label for="comparisonSyncToken">Token privado de sincronização DSS</label>'+
 '<input id="comparisonSyncToken" class="control full" type="password" required minlength="12" autocomplete="off" spellcheck="false" placeholder="Token privado do Render">'+
 '<p class="footer-note">O token será usado somente nesta consulta e não ficará salvo no navegador.</p>'+
 '<div class="v-bottom-actions"><button type="submit" class="btn btn-red">Consultar períodos A e B</button>'+
 '<button type="button" class="btn" data-action="comparison-sync-cancel">Cancelar</button></div>'+
 '</form></div></div>';
}
