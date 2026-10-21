import {summaryElectronicDocuments} from './e-documents.mjs';
const h=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const brl=v=>Number.isFinite(v)?new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v):'—';
const dt=v=>/^\d{4}-\d{2}-\d{2}$/.test(v||'')?v.slice(8)+'/'+v.slice(5,7)+'/'+v.slice(0,4):h(v||'—');
const kpi=(title,value,note)=>'<article class="kpi"><div class="kpi-label">'+h(title)+'</div><div class="kpi-value">'+h(value)+'</div><div class="kpi-sub">'+h(note)+'</div></article>';
const normalize=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const docSortColumns={
 valorFinal:{label:'Valor final',numeric:true},totalIss:{label:'ISS',numeric:true},
 dataEmissao:{label:'Emissão'},parceiro:{label:'Parceiro'},numeroNfse:{label:'Nº NFS-e'},
 fatura:{label:'Fatura'},status:{label:'Status'},tipoOperacao:{label:'Operação'},
 modelo:{label:'Modelo'},pontoApoio:{label:'Ponto de apoio'},id:{label:'ID DSS'}
};
const documentFilterCache=new WeakMap();
export function filteredElectronicDocuments(rows,s){
 // Paginar não altera filtros nem ordenação; reusar a lista calculada.
 const cacheKey=[s.from||'',s.to||'',s.search||'',s.docsStatus||'',s.docsModel||'',
  s.docsOperation||'',s.docsSupport||'',s.docsSortKey||'valorFinal',s.docsSortDir||'desc'].join('|');
 let cached=documentFilterCache.get(rows);
 if(!cached){cached=new Map();documentFilterCache.set(rows,cached);}
 if(cached.has(cacheKey))return cached.get(cacheKey);
 const query=normalize(s.search),key=Object.hasOwn(docSortColumns,s.docsSortKey||'')?s.docsSortKey:'valorFinal';
 const direction=s.docsSortDir==='asc'?1:-1;
 const result=rows.filter(r=>(!s.from||!r.dataEmissao||r.dataEmissao>=s.from)&&(!s.to||!r.dataEmissao||r.dataEmissao<=s.to)
   &&(!s.docsStatus||r.status===s.docsStatus)&&(!s.docsModel||r.modelo===s.docsModel)
   &&(!s.docsOperation||r.tipoOperacao===s.docsOperation)&&(!s.docsSupport||r.pontoApoio===s.docsSupport)
   &&(!query||[r.parceiro,r.tipoOperacao,r.numeroNfse,r.modelo,r.status,r.fatura,r.pontoApoio,r.id,
    r.valorFinal,r.totalIss,r.dataEmissao,r.dataEmissaoOriginal].some(v=>normalize(v).includes(query))))
   .sort((a,b)=>{
    const x=a[key],y=b[key];
    if(x===null||x===undefined||x==='')return y===null||y===undefined||y===''?0:1;
    if(y===null||y===undefined||y==='')return -1;
    if(docSortColumns[key].numeric)return direction*(x-y);
    return direction*String(x).localeCompare(String(y),'pt-BR',{numeric:true,sensitivity:'base'});
   });
 if(cached.size>=6)cached.clear();
 cached.set(cacheKey,result);
 return result;
}
export function renderElectronicDocuments(rows,state){
 const list=filteredElectronicDocuments(rows,state),v=summaryElectronicDocuments(list),real=state.docsSource==='live';
 const pending=state.docsSource==='pending';
 const notes=real?'Notas fiscais consultadas no DSS em '+(state.docsUpdatedAt||'horário não registrado')+'. Todos os módulos de Faturamento usam o mesmo período sincronizado.':
  pending?'As datas foram alteradas. Clique em SINCRONIZAR COM DSS ao lado das datas para atualizar todo o site.':
  'DEMONSTRAÇÃO: registros fictícios. Para carregar dados reais em todas as abas, clique em SINCRONIZAR COM DSS ao lado das datas no topo.';
 const options=(values,selected)=>values.map(v=>'<option value="'+h(v)+'" '+(v===selected?'selected':'')+'>'+h(v)+'</option>').join('');
 const types=[...new Set(rows.map(x=>x.status).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
 const models=[...new Set(rows.map(x=>x.modelo).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
 const operations=[...new Set(rows.map(x=>x.tipoOperacao).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
 const supports=[...new Set(rows.map(x=>x.pontoApoio).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
 const sorting=Object.entries(docSortColumns).map(([key,v])=>'<option value="'+key+'" '+((state.docsSortKey||'valorFinal')===key?'selected':'')+'>'+h(v.label)+'</option>').join('');
 const size=25,pages=Math.max(1,Math.ceil(list.length/size)),page=Math.min(Math.max(state.docsPage||1,1),pages);
 const pageRows=list.slice((page-1)*size,page*size);
 const cols=[
  ['numeroNfse','NFS-e'],['parceiro','Parceiro'],['tipoOperacao','Operação'],['modelo','Modelo'],
  ['status','Status'],['dataEmissao','Emissão'],['valorFinal','Valor final'],['totalIss','ISS'],
  ['fatura','Fatura'],['pontoApoio','Ponto de apoio'],['id','ID DSS']
 ];
 const th=cols.map(([key,label])=>'<th><button type="button" class="sort-link" data-doc-sort="'+key+'" title="Ordenar por '+h(label)+'">'+h(label)+' '+((state.docsSortKey||'valorFinal')===key?(state.docsSortDir==='asc'?'↑':'↓'):'↕')+'</button></th>').join('');
 const trs=pageRows.map(d=>'<tr>'+cols.map(([key])=>'<td>'+(
  key==='dataEmissao'?dt(d[key]):['valorFinal','totalIss'].includes(key)?h(brl(d[key])):h(d[key]||'—')
 )+'</td>').join('')+'</tr>').join('');
 return '<section class="ins-module"><div class="section-title"><h2>NOTAS FISCAIS E DOCUMENTOS</h2><span>'+(real?'Dados DSS':'Exemplos fictícios')+'</span></div>'+
 '<div class="info-strip '+(real?'live':'')+'">'+h(notes)+'</div>'+
 '<div class="kpis">'+kpi('DOCUMENTOS',String(v.count),'Na pesquisa e filtros')+
 kpi('COM NÚMERO NFS-e',String(v.withNfse),'Número preenchido')+
 kpi('COM FATURA',String(v.withFatura),'Fatura informada')+
 kpi('VALOR FINAL',v.valorFinal.count?brl(v.valorFinal.sum):'—',v.valorFinal.count+' valores conhecidos')+
 kpi('TOTAL ISS',v.totalIss.count?brl(v.totalIss.sum):'—',v.totalIss.count+' valores conhecidos')+'</div>'+
 '<div class="doc-table-toolbar"><label>Filtrar status<select id="docsStatus" class="control"><option value="">Todos</option>'+options(types,state.docsStatus)+'</select></label>'+
 '<label>Modelo<select id="docsModel" class="control"><option value="">Todos</option>'+options(models,state.docsModel)+'</select></label>'+
 '<label>Tipo de operação<select id="docsOperation" class="control"><option value="">Todas</option>'+options(operations,state.docsOperation)+'</select></label>'+
 '<label>Ponto de apoio<select id="docsSupport" class="control"><option value="">Todos</option>'+options(supports,state.docsSupport)+'</select></label>'+
 '<label>Ordenar por<select id="docsSortKey" class="control">'+sorting+'</select></label>'+
 '<label>Ordem<select id="docsSortDir" class="control"><option value="desc" '+(state.docsSortDir!=='asc'?'selected':'')+'>Maior → menor / Z → A</option><option value="asc" '+(state.docsSortDir==='asc'?'selected':'')+'>Menor → maior / A → Z</option></select></label>'+
 '<button class="btn btn-sm" type="button" data-action="docs-clear-filters">Limpar filtros</button>'+
 '<button class="btn btn-sm" type="button" data-action="docs-csv">EXPORTAR CSV</button></div>'+
 (state.docsError?'<p class="ins-inline-error">'+h(state.docsError)+'</p>':'')+
 '<div class="ins-responsive-table"><table><thead><tr>'+th+'</tr></thead><tbody>'+
 (trs||'<tr><td colspan="11">Nenhum documento encontrado para os filtros selecionados.</td></tr>')+
 '</tbody></table></div>'+
 '<div class="pagination"><span>'+list.length+' documentos · Página '+page+' de '+pages+'</span>'+
 '<div class="pagination-actions"><button type="button" class="btn btn-sm" data-action="docs-prev" '+(page<=1?'disabled':'')+'>Anterior</button>'+
 '<button type="button" class="btn btn-sm" data-action="docs-next" '+(page>=pages?'disabled':'')+'>Próxima</button></div></div>'+
 '<p class="ins-hint">Clique no título de qualquer coluna para ordenar. Valores não preenchidos ficam no final. Valor final e ISS não comprovam recebimento ou quitação.</p></section>';
}
/** A sincronização é global, embora o portal continue aberto sem login. */
export function renderDocumentsSyncDialog(state){
 return '<div class="overlay" data-action="docs-sync-backdrop">'+
 '<div class="drawer docs-sync-drawer" role="dialog" aria-modal="true" aria-labelledby="docsSyncTitle">'+
 '<div class="drawer-top"><h2 id="docsSyncTitle">Sincronizar o Faturamento com DSS</h2>'+
 '<button type="button" class="btn" data-action="docs-sync-cancel">Fechar</button></div>'+
 '<p>Esta ação sincroniza <strong>Painel, Faturamento, Documentos / NFS-e, Pedidos / CT-e, Clientes / Fretes e Comparativos</strong> usando o período selecionado.</p>'+
 '<p>Os registros são corporativos. Informe o token autorizado de sincronização para consultá-los. O portal permanece sem login para demonstrações.</p>'+
 '<form id="docsSyncForm" autocomplete="off">'+
 '<label for="docsSyncToken">Token privado de sincronização</label>'+
 '<input id="docsSyncToken" class="control full" type="password" required minlength="12" autocomplete="off" spellcheck="false" placeholder="Token privado do Render">'+
 '<p class="footer-note">O token é usado somente nas consultas dessa sincronização; não é salvo no navegador nem no GitHub.</p>'+
 '<p class="footer-note">Período: '+h(state.from)+' a '+h(state.to)+'</p>'+
 '<div class="v-bottom-actions"><button type="submit" class="btn btn-red">Sincronizar tudo agora</button>'+
 '<button type="button" class="btn" data-action="docs-sync-cancel">Cancelar</button></div>'+
 '</form></div></div>';
}
export function docsCsv(rows,state){
 const cols=[['numeroNfse','NFS-e'],['parceiro','Parceiro'],['tipoOperacao','Operação'],['modelo','Modelo'],['status','Status'],['dataEmissao','Emissão'],['valorFinal','Valor final'],['totalIss','ISS'],['fatura','Fatura'],['pontoApoio','Ponto de apoio']];
 const csv=[cols.map(c=>c[1]),...filteredElectronicDocuments(rows,state).map(r=>cols.map(c=>r[c[0]]??''))]
  .map(row=>row.map(v=>'"'+String(v).replace(/^[=+\-@\t\r]/,'\u0027$&').replace(/"/g,'""')+'"').join(';')).join('\r\n');
 return '\uFEFF'+csv;
}
