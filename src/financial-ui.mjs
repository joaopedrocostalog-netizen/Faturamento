/** COSTALOG Financeiro — apresenta somente indicadores e registros de faturamento. */
import {buildInsights} from './operational.mjs';
import {subsetPeriod} from './intelligence.mjs';
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
 return '<section class="ins-module"><div class="section-title"><h2>RESUMO DE FATURAMENTO</h2><span>Fonte: '+(state.mode==='live'?'DSS':'dados de demonstração')+'</span></div>'+
 '<div class="kpis">'+
 card('FRETES INFORMADOS',brl(t.freight.known?t.freight.sum:null),'Valor dos pedidos; não é pagamento recebido')+
 card('PEDIDOS DE FRETE',num(t.orders),'Registros no intervalo selecionado')+
 card('LIBERADOS PARA FATURAR',num(t.readyToInvoice),'Situação informada pela DSS')+
 card('LIBERADOS SEM FATURA',num(t.withoutInvoice),'Requer conferência do número da fatura')+
 card('COM Nº DE FATURA',num(withInvoice),'Não comprova emissão ou recebimento')+
 card('TICKET MÉDIO',brl(t.freight.known?t.freight.sum/t.freight.known:null),'Somente pedidos com valores preenchidos')+
 '</div><div class="v-bottom-actions"><button class="btn btn-red" data-nav="faturamento">CONTROLE DE FATURAMENTO →</button><button class="btn" data-nav="clientes">CLIENTES & FRETES ↗</button>'+ (SHOW_FINANCE_ONLY_TABS ? '<button class="btn" data-nav="relatorios">EXPORTAR RELATÓRIOS ↗</button>' : '')+'</div></section>'+
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
 let c=state.comparison;
 const inLoaded=state.loadedRange&&[current.from,current.to,previous.from,previous.to].every(x=>x>=state.loadedRange.from&&x<=state.loadedRange.to);
 if(state.mode==='demo'||inLoaded)c={currentRange:current,previousRange:previous,current:subsetPeriod(state.dataset,current),previous:subsetPeriod(state.dataset,previous)};
 const ready=c&&c.currentRange?.from===current.from&&c.currentRange?.to===current.to&&c.previousRange?.from===previous.from&&c.previousRange?.to===previous.to;
 const left=ready?comparisons(c.current):[],right=ready?comparisons(c.previous):[];
 const lines=left.map((m,i)=>{
   const prev=right[i].value,delta=m.value===null||prev===null?null:m.value-prev;
   const percent=delta!==null&&prev!==0?delta/Math.abs(prev)*100:null;
   const fmt=m.money?brl:num;
   return '<tr><td>'+esc(m.label)+'</td><td>'+esc(fmt(m.value))+'</td><td>'+esc(fmt(prev))+'</td><td>'+esc(fmt(delta))+'</td><td>'+esc(percent===null?'—':percent.toFixed(1).replace('.',',')+'%')+'</td></tr>';
 }).join('');
 return '<section class="ins-module"><div class="ins-toolbar"><div><h2>COMPARATIVO DE FATURAMENTO</h2><p>Compare pedidos, valores de fretes e situação de faturamento entre dois períodos.</p></div></div>'+
 '<div class="ins-compare-anchor"><label>Período A: de <input type="date" id="compareCurrentFrom" value="'+esc(current.from)+'"></label><label>Até <input type="date" id="compareCurrentTo" value="'+esc(current.to)+'"></label><label>Período B: de <input type="date" id="comparePreviousFrom" value="'+esc(previous.from)+'"></label><label>Até <input type="date" id="comparePreviousTo" value="'+esc(previous.to)+'"></label></div>'+
 '<div class="ins-period-label"><div><small>PERÍODO A</small><strong>'+esc(date(current.from))+' a '+esc(date(current.to))+'</strong></div><div><small>PERÍODO B</small><strong>'+esc(date(previous.from))+' a '+esc(date(previous.to))+'</strong></div></div>'+
 (state.mode==='live'&&!ready?'<div class="ins-compare-init"><p>Selecione ambos os períodos dentro do intervalo sincronizado ('+esc(state.loadedRange?.from||'—')+' a '+esc(state.loadedRange?.to||'—')+'). Para outras datas, sincronize novamente no topo.</p></div>':'')+
 (state.comparisonLoading?'<p class="ins-hint">Consultando DSS...</p>':'')+(state.comparisonError?'<p class="ins-inline-error">'+esc(state.comparisonError)+'</p>':'')+
 (ready?'<div class="ins-responsive-table"><table><thead><tr><th>Indicador</th><th>Período A</th><th>Período B</th><th>Diferença</th><th>Variação</th></tr></thead><tbody>'+lines+'</tbody></table></div>':'')+
 '<p class="ins-hint">Frete informado não comprova recebimento. Valores ausentes não são tratados como zero; variações com base zero não são calculadas.</p></section>';
}