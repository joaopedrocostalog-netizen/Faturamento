import {summaryElectronicDocuments} from './e-documents.mjs';
const h=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const brl=v=>Number.isFinite(v)?new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v):'—';
const dt=v=>/^\d{4}-\d{2}-\d{2}$/.test(v||'')?v.slice(8)+'/'+v.slice(5,7)+'/'+v.slice(0,4):h(v||'—');
const kpi=(title,value,note)=>'<article class="kpi"><div class="kpi-label">'+h(title)+'</div><div class="kpi-value">'+h(value)+'</div><div class="kpi-sub">'+h(note)+'</div></article>';
export function filteredElectronicDocuments(rows,s){
 const query=String(s.search||'').toLocaleLowerCase('pt-BR').trim();
 return rows.filter(r=>(!s.from||!r.dataEmissao||r.dataEmissao>=s.from)&&(!s.to||!r.dataEmissao||r.dataEmissao<=s.to)
  &&(!query||[r.parceiro,r.tipoOperacao,r.numeroNfse,r.modelo,r.status,r.fatura,r.pontoApoio,r.id].some(v=>String(v||'').toLocaleLowerCase('pt-BR').includes(query))));
}
export function renderElectronicDocuments(rows,state){
 const list=filteredElectronicDocuments(rows,state),v=summaryElectronicDocuments(list),real=state.docsSource==='live';
 const pending=state.docsSource==='pending';
 const notes=real?'Documentos consultados no DSS em '+(state.docsUpdatedAt||'horário não registrado')+'. As demais abas continuam em demonstração.':
  pending?'Novo período selecionado. Clique em SINCRONIZAR COM DSS para consultar esta faixa de datas.':
  'DEMONSTRAÇÃO: dados fictícios. Clique em SINCRONIZAR COM DSS e informe a autorização privada para consultar documentos reais.';
 const trs=list.map(d=>'<tr><td>'+h(d.numeroNfse||'—')+'</td><td>'+h(d.parceiro||'—')+'</td><td>'+h(d.tipoOperacao||'—')+'</td><td>'+h(d.modelo||'—')+'</td><td>'+h(d.status||'—')+'</td><td>'+dt(d.dataEmissao)+'</td><td>'+h(brl(d.valorFinal))+'</td><td>'+h(brl(d.totalIss))+'</td><td>'+h(d.fatura||'—')+'</td><td>'+h(d.pontoApoio||'—')+'</td></tr>').join('');
 return '<section class="ins-module"><div class="section-title"><h2>DOCUMENTOS ELETRÔNICOS / NFS-e</h2><span>'+(real?'Dados DSS':'Exemplos fictícios')+'</span></div>'+
 '<div class="info-strip">'+h(notes)+'</div>'+
 '<div class="kpis">'+kpi('DOCUMENTOS',String(v.count),'No período filtrado')+
 kpi('COM NÚMERO NFS-e',String(v.withNfse),'Número preenchido')+
 kpi('COM FATURA',String(v.withFatura),'Fatura informada')+
 kpi('VALOR FINAL',v.valorFinal.count?brl(v.valorFinal.sum):'—',v.valorFinal.count+' valores conhecidos')+
 kpi('TOTAL ISS',v.totalIss.count?brl(v.totalIss.sum):'—',v.totalIss.count+' valores conhecidos')+'</div>'+
 '<div class="v-bottom-actions"><button type="button" class="btn btn-red" data-action="docs-sync-open" '+(state.docsLoading?'disabled':'')+'>'+(state.docsLoading?'SINCRONIZANDO COM DSS...':'⟳ SINCRONIZAR COM DSS')+'</button>'+
 '<button type="button" class="btn" data-action="docs-csv">EXPORTAR DOCUMENTOS CSV</button></div>'+
 (state.docsError?'<p class="ins-inline-error">'+h(state.docsError)+'</p>':'')+
 '<div class="ins-responsive-table"><table><thead><tr><th>NFS-e</th><th>Parceiro</th><th>Operação</th><th>Modelo</th><th>Status</th><th>Emissão</th><th>Valor final</th><th>ISS</th><th>Fatura</th><th>Ponto de apoio</th></tr></thead><tbody>'+
 (trs||'<tr><td colspan="10">Nenhum documento no período ou busca selecionada.</td></tr>')+
 '</tbody></table></div><p class="ins-hint">NFS-e e fatura são referências informadas pelo DSS. Esta consulta não comprova recebimento ou quitação.</p></section>';
}
/** A área pública é livre; só a consulta de dados fiscais pede um token privado. */
export function renderDocumentsSyncDialog(state){
 return '<div class="overlay" data-action="docs-sync-backdrop">'+
 '<div class="drawer docs-sync-drawer" role="dialog" aria-modal="true" aria-labelledby="docsSyncTitle">'+
 '<div class="drawer-top"><h2 id="docsSyncTitle">Sincronizar NFS-e com DSS</h2>'+
 '<button type="button" class="btn" data-action="docs-sync-cancel">Fechar</button></div>'+
 '<p>Para consultar documentos fiscais reais, informe um token autorizado pelo backend no Render. O restante do site continua sem login e usa dados de demonstração.</p>'+
 '<form id="docsSyncForm" autocomplete="off">'+
 '<label for="docsSyncToken">Token privado de sincronização</label>'+
 '<input id="docsSyncToken" class="control full" type="password" required minlength="12" autocomplete="off" spellcheck="false" placeholder="Token privado do Render">'+
 '<p class="footer-note">O token não é salvo no navegador nem no GitHub. Ele será usado somente nesta consulta.</p>'+
 '<p class="footer-note">Período selecionado: '+h(state.from)+' a '+h(state.to)+'</p>'+
 '<div class="v-bottom-actions"><button type="submit" class="btn btn-red">Sincronizar agora</button>'+
 '<button type="button" class="btn" data-action="docs-sync-cancel">Cancelar</button></div>'+
 '</form></div></div>';
}
export function docsCsv(rows,state){
 const cols=[['numeroNfse','NFS-e'],['parceiro','Parceiro'],['tipoOperacao','Operação'],['modelo','Modelo'],['status','Status'],['dataEmissao','Emissão'],['valorFinal','Valor final'],['totalIss','ISS'],['fatura','Fatura'],['pontoApoio','Ponto de apoio']];
 const csv=[cols.map(c=>c[1]),...filteredElectronicDocuments(rows,state).map(r=>cols.map(c=>r[c[0]]??''))]
  .map(row=>row.map(v=>'"'+String(v).replace(/^[=+\-@\t\r]/,'\u0027$&').replace(/"/g,'""')+'"').join(';')).join('\r\n');
 return '\uFEFF'+csv;
}
