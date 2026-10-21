/** Tela conciliação financeira - interface simples e dados paginados. */
import {reconcileFreightDocuments,filteredReconciliation} from './reconciliation.mjs';
const h=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const currency=v=>Number.isFinite(v)?new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v):'—';
const date=v=>/^\d{4}-\d{2}-\d{2}$/.test(v||'')?v.slice(8)+'/'+v.slice(5,7)+'/'+v.slice(0,4):'—';
const n=v=>new Intl.NumberFormat('pt-BR').format(v);
const titles={vinculado:'Referência encontrada',conferir:'Conferir referências',
 sem_correspondencia:'Não encontrado no período',sem_referencia:'Pedido sem referência',
 nao_consultado:'Aguardando sincronização'};
const kpi=(name,value,sub)=>'<article class="kpi"><div class="kpi-label">'+h(name)+'</div><div class="kpi-value">'+h(n(value))+'</div><div class="kpi-sub">'+h(sub)+'</div></article>';
export function renderReconciliation(orders,documents,receivables,state={}){
 const result=reconcileFreightDocuments(orders,documents,receivables,{
  docsSource:state.docsSource,recvSource:state.recvSource});
 const rows=filteredReconciliation(result,state),size=25,pages=Math.max(1,Math.ceil(rows.length/size));
 const page=Math.min(pages,Math.max(1,Number(state.reconPage)||1));
 const visible=rows.slice((page-1)*size,page*size);
 const counts=Object.fromEntries(Object.keys(titles).map(key=>[key,result.entries.filter(x=>
  (state.recvCompany==='all'||!state.recvCompany||x.company===state.recvCompany)&&x.status===key).length]));
 const opts=(values,current)=>values.map(([value,label])=>
 '<option value="'+h(value)+'" '+(current===value?'selected':'')+'>'+h(label)+'</option>').join('');
 const statusOpts=[['todos','Todas as situações'],...Object.entries(titles)];
 const sortOpts=[['prioridade','O que precisa de conferência primeiro'],['data','Emissões mais recentes'],['valor','Maior valor do frete']];
 const body=visible.map(r=>'<tr>'+
 '<td>'+h(r.company==='unidentified'?'Empresa não identificada':r.company)+'</td>'+
 '<td>'+h(r.pedido||'—')+'</td><td>'+h(r.cliente||'—')+'</td>'+
 '<td>'+h(r.fatura||'—')+'</td><td>'+h(r.numeroNfse||r.doc?.numeroNfse||'—')+'</td>'+
 '<td>'+date(r.data)+'</td><td>'+h(currency(r.valor))+'</td>'+
 '<td><span class="recon-status '+h(r.status)+'">'+h(titles[r.status])+'</span><small class="recon-reason">'+h(r.reason)+'</small></td>'+
 '<td>'+ (r.receivablesAvailable?h(n(r.installments))+' parcela(s) relacionada(s)':'Não consultado')+'</td>'+
 '</tr>').join('');
 return '<section class="ins-module recon-view"><div class="section-title"><h2>CONFERÊNCIA DE FATURAS E NOTAS</h2><span>Consulta somente leitura</span></div>'+
 '<p class="mgmt-intro">Veja quais pedidos de frete possuem a mesma referência de fatura ou de NFS-e registrada nos documentos eletrônicos. Use os filtros para encontrar registros que precisam de atenção.</p>'+
 (!result.docsAvailable?'<div class="info-strip">Sincronize os documentos fiscais com o sistema antes de verificar os vínculos. Os registros abaixo ainda não foram conferidos.</div>':'')+
 '<div class="kpis">'+kpi('Pedidos de frete',rows.length,'Após filtros')+
 kpi('Referência encontrada',counts.vinculado,'Número da fatura ou NFS-e correspondente')+
 kpi('Conferir referências',counts.conferir,'Referências repetidas ou conflitantes')+
 kpi('Não encontrado',counts.sem_correspondencia,'Pode estar fora das datas consultadas')+
 kpi('Sem referência no pedido',counts.sem_referencia,'Fatura e NFS-e não preenchidas')+'</div>'+
 '<div class="recon-help"><strong>Como interpretar</strong><p>Uma referência encontrada comprova apenas que os números coincidem nos registros consultados. Não comprova a emissão fiscal, a empresa emissora ou o pagamento. “Não encontrado” não significa que o documento não exista: ele pode estar fora do período sincronizado.</p></div>'+
 '<div class="recon-toolbar"><label>Mostrar<select id="reconStatus" class="control">'+opts(statusOpts,state.reconStatus||'todos')+'</select></label>'+
 '<label>Ordenar por<select id="reconOrder" class="control">'+opts(sortOpts,state.reconOrder||'prioridade')+'</select></label>'+
 '<label class="recon-search">Buscar pedido, cliente, fatura ou nota<input id="reconSearch" type="search" class="control" autocomplete="off" placeholder="Digite uma referência..." value="'+h(state.reconSearch||'')+'"></label>'+
 '<button type="button" class="btn btn-sm" data-action="recon-clear">Limpar</button></div>'+
 '<div class="ins-responsive-table recon-table"><table><thead><tr><th>Empresa do pedido</th><th>Pedido</th><th>Cliente</th><th>Fatura</th><th>NFS-e relacionada</th><th>Emissão</th><th>Frete informado</th><th>Conferência</th><th>Parcelas</th></tr></thead><tbody>'+
 (body||'<tr><td colspan="9">Nenhum pedido encontrado nos filtros selecionados.</td></tr>')+'</tbody></table></div>'+
 '<div class="pagination"><span>'+n(rows.length)+' pedido(s) · Página '+page+' de '+pages+'</span>'+
 '<div class="pagination-actions"><button type="button" class="btn btn-sm" data-action="recon-prev" '+(page===1?'disabled':'')+'>Anterior</button>'+
 '<button type="button" class="btn btn-sm" data-action="recon-next" '+(page===pages?'disabled':'')+'>Próxima</button></div></div>'+
 '<p class="ins-hint">As parcelas são relacionadas somente quando a fatura e a empresa do pedido coincidem. A quantidade não representa pagamento recebido. Para verificar emissão e situação fiscal, consulte o documento no sistema de origem.</p></section>';
}
