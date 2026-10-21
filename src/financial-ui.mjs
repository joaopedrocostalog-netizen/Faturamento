/** COSTALOG Financeiro — apresenta somente indicadores e registros de faturamento. */
import {buildInsights} from './operational.mjs';
import {invoiceSummary} from './invoice-summary.mjs';
import {receivablesByCompany,overviewByCompany} from './companies.mjs';
import {SHOW_FINANCE_ONLY_TABS} from './access-ui.mjs';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=v=>Number.isFinite(v)?new Intl.NumberFormat('pt-BR').format(v):'—';
const brl=v=>Number.isFinite(v)?new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v):'—';
const date=s=>/^\d{4}-\d{2}-\d{2}$/.test(s||'')?s.slice(8)+'/'+s.slice(5,7)+'/'+s.slice(0,4):'—';
const card=(name,value,info)=>'<article class="kpi"><div class="kpi-label">'+esc(name)+'</div><div class="kpi-value">'+esc(value)+'</div><div class="kpi-sub">'+esc(info)+'</div></article>';
export function renderFinanceDashboard(_orders,state){
 // IMPORTANTE: nenhum valor ou quantidade deste resumo vem de pedidos de frete.
 // O campo valorTotal não pode ser somado linha a linha (repetido nas parcelas).
 const loaded=state.recvSource==='live'&&!state.recvLoading;
 const financial=loaded?invoiceSummary(receivablesByCompany(state.recvRows||[],state.recvCompany||'all')):null;
 const selected=state.recvCompany&&state.recvCompany!=='all'?state.recvCompany:'Todas as empresas';
 const reference=state.recvRef==='V'?'data de vencimento':state.recvRef==='P'?'data de pagamento (somente pagas)':'data de emissão';
 const numberOrDash=value=>financial?num(value):'—';
 const moneyOrDash=(amount,known)=>financial&&known?brl(amount):'—';
 const unavailable=state.recvLoading?'Consultando faturas...':
  state.recvSource==='unavailable'?'Não foi possível consultar Contas a Receber. Confira o erro na aba financeira.':
  'As faturas ainda não foram consultadas neste período. Clique em Sincronizar com DSS, junto às datas, para carregar as três referências.';
 return '<section class="ins-module finance-invoices"><div class="section-title"><h2>RESUMO DE FATURAS</h2>'+
 '<span>'+(loaded?'Fonte: Contas a Receber • DSS':'Aguardando dados financeiros')+'</span></div>'+
 '<p class="ins-hint">Resumo baseado exclusivamente nas faturas e parcelas do módulo Contas a Receber. Não inclui valores de pedidos de frete.</p>'+
 (!loaded?'<div class="info-strip '+(state.recvSource==='unavailable'?'error':'')+'">'+esc(unavailable)+
 ' <button type="button" class="btn btn-sm" data-nav="receber">Consultar faturas</button></div>':'')+
 (loaded?'<div class="finance-source-note"><strong>Consulta:</strong> '+esc(selected)+
 ' · '+esc(reference)+' · '+esc(state.from||'')+' a '+esc(state.to||'')+
 (state.recvRef==='P'?' · Somente parcelas pagas no período':'')+'</div>':'')+
 '<div class="kpis">'+
 card('FATURAS IDENTIFICADAS',numberOrDash(financial?.invoices),'Números de fatura distintos, sem duplicar parcelas')+
 card('PARCELAS REGISTRADAS',numberOrDash(financial?.installments),'Quantidade de parcelas da consulta financeira')+
 card('VALOR DAS PARCELAS',moneyOrDash(financial?.face,financial?.faceKnown),'Soma dos valores das parcelas informadas; não é receita recebida')+
 card('VALOR RECEBIDO INFORMADO',moneyOrDash(financial?.paid,financial?.paidKnown),'Somente pagamentos preenchidos no Contas a Receber')+
 card('SALDO A RECEBER',moneyOrDash(financial?.residual,financial?.residualKnown),'Saldo residual informado nas parcelas')+
 card('FATURAS COM SALDO',numberOrDash(financial?.invoicesWithConfirmedBalance),'Com alguma parcela de saldo residual positivo')+
 card('FATURAS COM VENCIMENTO PASSADO',numberOrDash(financial?.invoicesOverdue),
  financial&&financial.lateKnown?brl(financial.lateResidual)+' em parcelas vencidas com saldo':'Vencimentos com saldo residual confirmado')+
 card('FATURAS MARCADAS COMO PAGAS',numberOrDash(financial?.paidInvoices),'Todas as parcelas da fatura marcadas como pagas')+
 (financial?.invoicesWithoutNumber?card('PARCELAS SEM NÚMERO DE FATURA',num(financial.invoicesWithoutNumber),'Registros sem referência para identificar a fatura'):'')+
 '</div>'+
 (financial&&((financial.faceKnown<financial.installments)||(financial.paidKnown<financial.installments)||(financial.residualKnown<financial.installments))?
  '<p class="finance-source-warning">Algumas parcelas não trazem todos os valores. As somas consideram somente campos preenchidos: '+num(financial.faceKnown)+' valores de parcelas, '+
  num(financial.paidKnown)+' pagamentos e '+num(financial.residualKnown)+' saldos residuais. Dados ausentes não foram estimados.</p>':'')+
 '<div class="v-bottom-actions"><button class="btn btn-red" data-nav="receber">VER FATURAS E PARCELAS →</button>'+
 '<button class="btn" data-nav="conciliacao">CONFERIR FATURAS E NOTAS →</button>'+
 '<button class="btn" data-nav="ctes">VER PEDIDOS DE FRETE (OPERACIONAL) →</button>'+
 (SHOW_FINANCE_ONLY_TABS?'<button class="btn" data-nav="relatorios">RELATÓRIOS →</button>':'')+
 '</div></section>';
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
 const left=ready?comparisons(overviewByCompany(c.current,state.recvCompany||'all')):[],right=ready?comparisons(overviewByCompany(c.previous,state.recvCompany||'all')):[];
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
 (ready?'<p class="ins-hint">Resultado real do DSS somente para os dois períodos selecionados. Empresa: '+esc(state.recvCompany==='all'||!state.recvCompany?'Todas':state.recvCompany)+'. A empresa não altera as datas do Comparativo.</p>':'')+
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
