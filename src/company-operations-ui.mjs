/** Visão operacional por empresa DSS — só pedidos e viagens, sem duplicar CT-e. */
import {operationalCompanyMetrics,COMPANY_UNIDENTIFIED} from './companies.mjs';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v);
const num=v=>new Intl.NumberFormat('pt-BR').format(v);
export function renderOperationalCompanies(data,state={}){
 const all=operationalCompanyMetrics(data),withTrips=Array.isArray(data?.viagens);
 const show=all.filter(x=>x.pedidos||x.viagens),max=Math.max(0,...show.map(x=>x.valorFrete));
 const label=s=>s===COMPANY_UNIDENTIFIED?'Outras / não identificadas':s;
 return '<section class="mgmt-alerts company-ops"><h3>'+(withTrips?'FRETES E VIAGENS':'FRETES DOS PEDIDOS')+' POR EMPRESA — DSS</h3>'+
 '<p>A origem é o campo <code>empresa</code> das APIs <code>listarPedidosFrete</code> e <code>listarViagens</code>. Pedidos e viagens são contados separadamente; CT-e não é somado outra vez. Frete é valor informado, não recebimento.</p>'+
 (show.length?'<div class="company-ops-grid">'+show.map(g=>
 '<article class="company-ops-item"><strong>'+esc(label(g.name))+'</strong><small>'+num(g.pedidos)+' pedidos'+(withTrips?' · '+num(g.viagens)+' viagens':'')+'</small>'+
 '<div class="mgmt-bar-track"><div class="mgmt-bar-fill" style="width:'+(max>0?Math.min(100,g.valorFrete/max*100).toFixed(1):'0')+'%"></div></div>'+
 '<div class="company-ops-values"><span>Fretes: '+(g.fretesComValor?esc(money(g.valorFrete)):'—')+'</span><span>Valor a receber do pedido: '+(g.receberComValor?esc(money(g.valorReceber)):'—')+'</span></div>'+
 '</article>').join('')+'</div>':'<p class="ins-hint">Nenhum pedido ou viagem para a empresa e período escolhidos. Confira a sincronização DSS e o filtro de empresa.</p>')+
 '<p class="ins-hint">Contas a Receber (parcelas) é outra fonte e não deve ser somada com o valor de frete dos pedidos. A API NFS-e atualmente não fornece <code>empresa</code> no esquema conhecido.</p></section>';
}
