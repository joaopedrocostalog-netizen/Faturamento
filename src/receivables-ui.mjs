/** Parcelas a receber: tabela paginada, 34 campos em detalhes e gráficos leves, sem dependências. */
import {RECEIVABLE_FIELDS,RECEIVABLE_NUMBERS,RECEIVABLE_DATES,receivablesSummary} from './receivables.mjs';
import {COSTALOG_COMPANIES,COMPANY_UNIDENTIFIED,COMPANY_ALL,receivablesByCompany,companyDistribution} from './companies.mjs';
const h=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const brl=x=>Number.isFinite(x)?new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(x):'—';
const num=x=>new Intl.NumberFormat('pt-BR').format(x);
const dt=x=>/^\d{4}-\d{2}-\d{2}$/.test(x||'')?x.slice(8)+'/'+x.slice(5,7)+'/'+x.slice(0,4):'—';
const memo=new WeakMap();
const groupColors=['#e33b57','#a5a7b1','#7c859d','#e0a052'];
const GROUPS={E:['Emissão','dataEmissao'],V:['Vencimento','dataVencimento'],P:['Pagamento (somente pagas)','dataPagamento']};
export function receivablesPriority(row,today=new Date().toISOString().slice(0,10)){
 const paid=String(row.situacaoFatura||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
 const settled=/^(pago|paga|pagos|pagas|quitado|quitada|liquidado|liquidada|recebido|recebida)$/.test(paid);
 if(settled)return 3;
 if(!row.dataVencimento)return 2;
 return row.dataVencimento<today?0:1;
}
export function filteredReceivables(rows,state){
 rows=receivablesByCompany(rows,state.recvCompany||COMPANY_ALL);
 const key=state.recvSortKey||'prioridade',dir=state.recvSortDir==='desc'?-1:1,
  q=String(state.recvSearch||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim(),
  status=state.recvStatus||'',quick=state.recvQuick||'todos';
 const group=GROUPS[state.recvRef||'E']||GROUPS.E,ds=group[1],
  today=state.today||new Date().toISOString().slice(0,10),
  soon=new Date(Date.parse(today+'T12:00:00Z')+7*86400000).toISOString().slice(0,10);
 const ck=[state.from,state.to,state.recvRef,key,dir,status,q,quick,today].join('|');
 let c=memo.get(rows);if(!c){c=new Map();memo.set(rows,c);}if(c.has(ck))return c.get(ck);
 const filtered=rows.filter(row=>{
  const date=row[ds];if(date&&((state.from&&date<state.from)||(state.to&&date>state.to)))return false;
  if(status&&row.situacaoFatura!==status)return false;
  if(quick!=='todos'){
   const urgency=receivablesPriority(row,today);
   const positive=Number.isFinite(row.valorResidual)&&row.valorResidual>0;
   if(quick==='vencidas'&&!(urgency===0&&positive))return false;
   if(quick==='vence7'&&!(urgency===1&&row.dataVencimento<=soon&&positive))return false;
   if(quick==='abertas'&&urgency===3)return false;
   if(quick==='pagas'&&urgency!==3)return false;
   if(quick==='divergentes'&&!((urgency===3&&(!Number.isFinite(row.valorPagamento)||row.valorPagamento===0))||
       (urgency!==3&&Number.isFinite(row.valorResidual)&&row.valorResidual===0&&Number.isFinite(row.valor)&&row.valor>0)||
       !row.tipoFatura))return false;
  }
  if(q&&!Object.values(row).some(v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(q)))return false;
  return true;
 }).sort((a,b)=>{
  if(key==='prioridade'){
   const rank=receivablesPriority(a,today)-receivablesPriority(b,today);
   if(rank!==0)return rank;
   const da=a.dataVencimento||'',db=b.dataVencimento||'';
   if(da&&db&&da!==db)return da.localeCompare(db);
   if(da!==db)return da? -1:1;
   return String(a.parceiro||'').localeCompare(String(b.parceiro||''),'pt-BR');
  }
  const x=a[key],y=b[key];
  if(x===null||x===undefined||x==='')return y===null||y===undefined||y===''?0:1;
  if(y===null||y===undefined||y==='')return -1;
  if(RECEIVABLE_NUMBERS.includes(key))return (x-y)*dir;
  return String(x).localeCompare(String(y),'pt-BR',{numeric:true,sensitivity:'base'})*dir;
 });
 if(c.size>6)c.clear();c.set(ck,filtered);return filtered;
}
/** O gráfico usa valor residual, valor nominal OU quantidade, sempre com título explícito.
 * Não é permitido substituir R$ 0,00 do DSS por pagamentos inferidos.
 */
function barChart(title,rows,unit='money',metric='value'){
 const entries=[...rows].sort((a,b)=>(b[metric]??0)-(a[metric]??0)||b.count-a.count).slice(0,6);
 const max=Math.max(0,...entries.map(x=>unit==='count'?x.count:(x[metric]??0)));
 return '<section class="mgmt-chart"><div class="mgmt-chart-head"><h3>'+h(title)+'</h3></div><div class="mgmt-bars">'+
 (entries.length?entries.map(e=>{
  const value=unit==='count'?e.count:e[metric],width=max?Math.max(0,value/max*100):0;
  const known=metric==='face'?e.faceKnown:metric==='paid'?e.paidKnown:e.known;
  const displayed=unit==='count'?num(value):(known?brl(value):'—');
  return '<div class="mgmt-bar-row"><div class="mgmt-bar-top"><span title="'+h(e.name)+'">'+h(e.name)+'</span><strong>'+h(displayed)+'</strong></div>'+
   '<div class="mgmt-bar-track"><div class="mgmt-bar-fill" style="width:'+Math.min(100,Math.max(0,width)).toFixed(1)+'%"></div></div>'+
   '<small>'+num(e.count)+' parcela(s)'+(unit==='money'?' · '+num(known||0)+' valores presentes':'')+'</small></div>';
 }).join(''):'<p class="ins-hint">Sem dados para este gráfico.</p>')+'</div></section>';
}
function agingTable(rows){
 return '<section class="mgmt-alerts"><h3>VENCIMENTOS E FAIXAS DE ATRASO</h3>'+
 '<p>Valores residuais e nominais são apresentados separadamente. Uma parcela com valor residual zerado informado pelo DSS não é considerada saldo confirmado em aberto.</p>'+
 '<div class="ins-responsive-table"><table><thead><tr><th>Faixa</th><th>Parcelas</th><th>Saldo residual informado</th><th>Valor nominal das parcelas</th></tr></thead>'+
 '<tbody>'+rows.map(g=>'<tr><td>'+h(g.name)+'</td><td>'+num(g.count)+'</td><td>'+h(g.known?brl(g.value):'—')+'</td><td>'+h(g.faceKnown?brl(g.face):'—')+'</td></tr>').join('')+'</tbody></table></div></section>';
}
const companyTitle=k=>k===COMPANY_UNIDENTIFIED?'Outras / não identificadas':k;
export function renderCompanyFilter(rows,state){
 const selected=state.recvCompany||COMPANY_ALL;
 const distribution=companyDistribution(rows);
 return '<section class="recv-enterprises"><div class="recv-enterprise-toolbar">'+
 '<div><strong>EMPRESAS DO GRUPO</strong><p>Filtre parcelas, pedidos e viagens pelo campo empresa das respectivas APIs DSS. A contagem dos cartões abaixo se refere somente a parcelas; NFS-e sem empresa não é separada.</p></div>'+
 '<label for="recvCompany">Empresa<select class="control" id="recvCompany">'+
 '<option value="all" '+(selected===COMPANY_ALL?'selected':'')+'>Todas as empresas</option>'+
 COSTALOG_COMPANIES.map(k=>'<option value="'+h(k)+'" '+(selected===k?'selected':'')+'>'+h(k)+'</option>').join('')+
 '<option value="unidentified" '+(selected===COMPANY_UNIDENTIFIED?'selected':'')+'>Outras / não identificadas</option></select></label></div>'+
 '<div class="recv-company-summaries">'+distribution.map(({name,count})=>
 '<button type="button" class="recv-company-tile '+(selected===name?'active':'')+'" data-company-select="'+h(name)+'">'+
 '<span>'+h(companyTitle(name))+'</span><strong>'+num(count)+'</strong><small>parcela(s)</small></button>').join('')+'</div>'+
 (distribution.at(-1)?.count?'<p class="ins-hint">Há '+num(distribution.at(-1).count)+' registro(s) cujo campo empresa não corresponde exatamente a uma das quatro empresas. Não foram atribuídos automaticamente para evitar valores incorretos.</p>':'')+
 '</section>';
}
function companyBreakdown(rows){
 const groups=companyDistribution(rows);
 return '<section class="mgmt-alerts"><h3>RESUMO FINANCEIRO POR EMPRESA</h3>'+
 '<p>Grupos independentes definidos pelo campo empresa. Pagamentos, valores nominais e saldos são indicadores separados.</p>'+
 '<div class="recv-company-breakdown">'+groups.map(({name,count})=>{
  const x=receivablesSummary(receivablesByCompany(rows,name));
  return '<article class="recv-company-group"><strong>'+h(companyTitle(name))+'</strong>'+
   '<div><span>Parcelas</span><b>'+num(count)+'</b></div>'+
   '<div><span>Pagamentos</span><b>'+h(x.paidKnown?brl(x.paid):'—')+'</b></div>'+
   '<div><span>Saldo residual</span><b>'+h(x.residualKnown?brl(x.residual):'—')+'</b></div>'+
   '<div><span>Valor nominal</span><b>'+h(x.faceKnown?brl(x.face):'—')+'</b></div></article>';
 }).join('')+'</div></section>';
}
const card=(label,value,desc)=>'<article class="kpi"><div class="kpi-label">'+h(label)+'</div><div class="kpi-value">'+h(value)+'</div><div class="kpi-sub">'+h(desc)+'</div></article>';
export function renderReceivables(rows,state){
 const r=filteredReceivables(rows,state),summary=receivablesSummary(r);
 const financialMode=summary.residual!==0?'residual':summary.faceKnown>0&&summary.face!==0?'nominal':'count';
 const allTypesMissing=summary.count>0&&summary.missingTypes===summary.count;
 const notices=[
  summary.paidWithoutAmount?num(summary.paidWithoutAmount)+' parcela(s) classificadas como pagas pelo DSS, mas sem valor de pagamento preenchido. O valor nominal NÃO será tratado como pagamento recebido.':'',
  summary.openWithZeroResidual?num(summary.openWithZeroResidual)+' parcela(s) classificadas como abertas com valor nominal positivo, mas com saldo zerado informado no sistema. Saldo a receber não pode ser confirmado por esse campo.':'',
  summary.missingTypes?num(summary.missingTypes)+' parcela(s) sem tipo de fatura informado pelo sistema. O gráfico usa centro de custo como classificação alternativa quando nenhum tipo está disponível.':'',
  summary.missingResidual?num(summary.missingResidual)+' parcela(s) sem saldo residual informado. Valores ausentes não são considerados zero.':''
 ].filter(Boolean);
 const ref=state.recvRef||'E',source=state.recvSource==='live'?'DSS':state.recvSource==='unavailable'?'Consulta indisponível':'Demonstração';
 const statuses=[...new Set(rows.map(x=>x.situacaoFatura).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
 const fields=Object.entries(RECEIVABLE_FIELDS),sortKeys=['prioridade','dataVencimento','qtdDiasAberto','valorResidual','valorPagamento','valor','dataPagamento','dataEmissao','parceiro','fatura','situacaoFatura'];
 const order=sortKeys.map(k=>'<option value="'+k+'" '+((state.recvSortKey||'prioridade')===k?'selected':'')+'>'+h(k==='prioridade'?'Prioridade: vencidas e próximas':RECEIVABLE_FIELDS[k])+'</option>').join('');
 const opts=statuses.map(x=>'<option value="'+h(x)+'" '+(state.recvStatus===x?'selected':'')+'>'+h(x)+'</option>').join('');
 const limit=25,pages=Math.max(1,Math.ceil(r.length/limit)),page=Math.min(Math.max(1,state.recvPage||1),pages),visible=r.slice((page-1)*limit,page*limit);
 const cols=['dataVencimento','parceiro','fatura','parcela','situacaoFatura','valor','valorPagamento','valorResidual','dataPagamento','dataEmissao'];
 const colsHtml=cols.map(k=>'<th><button class="recv-sort-col" type="button" data-recv-sort="'+h(k)+'" title="Ordenar por '+h(RECEIVABLE_FIELDS[k])+'">'+h(RECEIVABLE_FIELDS[k])+' ↕</button></th>').join('')+'<th>Detalhes</th>';
 const body=visible.map((row,i)=>'<tr>'+cols.map(k=>'<td>'+h(RECEIVABLE_NUMBERS.includes(k)?brl(row[k]):RECEIVABLE_DATES.includes(k)?dt(row[k]):row[k]||'—')+'</td>').join('')+
 '<td><details class="recv-details"><summary>Ver campos</summary><div class="recv-details-grid">'+fields.map(([k,label])=>
 '<div><b>'+h(label)+'</b><span>'+h(RECEIVABLE_NUMBERS.includes(k)?(k==='qtdDiasAberto'?row[k]??'—':brl(row[k])):RECEIVABLE_DATES.includes(k)?dt(row[k]):row[k]||'—')+'</span></div>').join('')+
 '</div></details></td></tr>').join('');
 const warnings=(state.recvError?'<div class="info-strip error">'+h(state.recvError)+'</div>':'')+
 (notices.length?'<section class="recv-data-warning"><strong>CONFERÊNCIA DOS CAMPOS FINANCEIROS</strong><ul>'+notices.map(msg=>'<li>'+h(msg)+'</li>').join('')+'</ul>'+
 '<p>Essas diferenças podem refletir campos não preenchidos na origem. Consulte a fatura no DSS antes de realizar cobranças.</p></section>':'');
 return '<section class="ins-module"><div class="section-title"><h2>CONTAS A RECEBER / PARCELAS</h2><span>'+h(source)+'</span></div>'+
 '<p class="ins-hint">Para períodos longos, o portal consulta o DSS mês a mês, sem mostrar totais incompletos. Em caso de tempo limite, o mês afetado será dividido em quinzenas automaticamente.</p>'+
 '<p class="ins-hint">A consulta considera '+h(GROUPS[ref][0].toLowerCase())+' no período selecionado. Selecione o referencial E / V / P para consultar emissão, vencimento ou pagamento. A opção P é exclusiva para parcelas pagas, conforme a documentação DSS.</p>'+
 warnings+
 (state.recvCompany==='all'||!state.recvCompany?companyBreakdown(rows):'')+
 '<div class="recv-toolbar"><label>Referência do período<select class="control" id="recvRef"><option value="E" '+(ref==='E'?'selected':'')+'>Emissão (E)</option><option value="V" '+(ref==='V'?'selected':'')+'>Vencimento (V)</option><option value="P" '+(ref==='P'?'selected':'')+'>Pagamento (P)</option></select></label>'+
 '<button class="btn btn-red" type="button" data-action="recv-consult" '+(state.recvLoading?'disabled':'')+'>'+(state.recvLoading?h(state.recvProgress||'CONSULTANDO DSS...'):'CONSULTAR CONTAS A RECEBER NO DSS')+'</button>'+
 '<label>Vencimentos e prioridades<select class="control" id="recvQuick">'+
 '<option value="todos" '+(!state.recvQuick||state.recvQuick==='todos'?'selected':'')+'>Todas as parcelas</option>'+
 '<option value="vencidas" '+(state.recvQuick==='vencidas'?'selected':'')+'>Vencidas com saldo confirmado</option>'+
 '<option value="vence7" '+(state.recvQuick==='vence7'?'selected':'')+'>Vencem em 7 dias com saldo</option>'+
 '<option value="abertas" '+(state.recvQuick==='abertas'?'selected':'')+'>Não quitadas (pela situação)</option>'+
 '<option value="pagas" '+(state.recvQuick==='pagas'?'selected':'')+'>Pagas (pela situação)</option>'+
 '<option value="divergentes" '+(state.recvQuick==='divergentes'?'selected':'')+'>Conferir dados divergentes</option></select></label>'+
 '<label>Situação<select class="control" id="recvStatus"><option value="">Todas</option>'+opts+'</select></label>'+
 '<label>Ordenar<select class="control" id="recvSortKey">'+order+'</select></label>'+
 '<label>Ordem<select class="control" id="recvSortDir"><option value="desc" '+(state.recvSortDir==='desc'?'selected':'')+'>Maior / mais recente</option><option value="asc" '+(state.recvSortDir!=='desc'?'selected':'')+'>Menor / mais antigo</option></select></label>'+
 '<button type="button" class="btn" data-action="recv-clear">Limpar filtros</button></div>'+
 '<div class="v-search-row"><div class="v-search-field"><input id="recvSearchInput" type="search" class="control full" autocomplete="off" placeholder="Pesquise parceiro, parcela, fatura, CNPJ, conta ou qualquer campo..." value="'+h(state.recvSearch||'')+'"></div></div>'+
 '<div class="kpis">'+card('PARCELAS',num(summary.count),'Registros após filtros')+
 card('VALOR NOMINAL DAS PARCELAS',summary.faceKnown?brl(summary.face):'—',num(summary.faceKnown)+' valores informados')+
 card('PAGAMENTO INFORMADO PELO DSS',summary.paidKnown?brl(summary.paid):'—',num(summary.paidKnown)+' valores preenchidos; conferir divergências')+
 card('SALDO RESIDUAL INFORMADO',summary.residualKnown?brl(summary.residual):'—',num(summary.residualKnown)+' campos preenchidos')+
 card('VENCIDAS COM SALDO',num(summary.lateCount),summary.lateKnown?brl(summary.lateResidual)+' em residual confirmado':'Somente saldos residuais positivos')+
 card('A VENCER EM 7 DIAS',num(summary.dueSoonCount),brl(summary.dueSoonResidual)+' em residual confirmado')+
 (summary.paidWithoutAmount?card('PAGAS SEM VALOR CONFIRMADO',num(summary.paidWithoutAmount),'Valor nominal associado: '+brl(summary.inferredPaidNominal)+' (não recebido confirmado)'):'')+
 (summary.missingTypes?card('TIPO DE FATURA AUSENTE',num(summary.missingTypes),'Informação não preenchida na API'):'')+
 '</div>'+
 '<div class="mgmt-chart-grid">'+
 (state.recvCompany==='all'||!state.recvCompany?barChart('Saldo residual por empresa (DSS)',companyDistribution(rows).map(({name,count})=>{
  const x=receivablesSummary(receivablesByCompany(rows,name));
  return {name:companyTitle(name),count,value:x.residual,known:x.residualKnown,face:x.face,faceKnown:x.faceKnown,paid:x.paid,paidKnown:x.paidKnown};
 })): '')+
 (financialMode==='residual'?barChart('Saldo RESIDUAL informado por parceiro',summary.parceiros):
  financialMode==='nominal'?barChart('Valor NOMINAL por parceiro (não é saldo)',summary.parceiros,'money','face'):
  barChart('Quantidade de parcelas por parceiro (valores não disponíveis)',summary.parceiros,'count','count'))+
 (summary.positivePaid>0?barChart('Pagamentos informados no DSS por situação',summary.situacoes,'money','paid'):
  barChart('Parcelas por situação — pagamentos não informados',summary.situacoes,'count','count'))+
 (summary.positiveResidual>0?barChart('Saldo residual informado por situação',summary.situacoes):
  barChart('Quantidade por situação — residual sem valor positivo',summary.situacoes,'count','count'))+
 (financialMode==='residual'?barChart('Saldo RESIDUAL por mês de vencimento',summary.vencimentos):
  financialMode==='nominal'?barChart('Valor NOMINAL por mês de vencimento',summary.vencimentos,'money','face'):
  barChart('Quantidade de parcelas por mês de vencimento',summary.vencimentos,'count','count'))+
 (allTypesMissing?barChart('Parcelas por centro de custo (tipo não informado)',summary.centros,'count','count'):
  barChart('Parcelas por tipo de fatura informado',summary.tipos,'count','count'))+'</div>'+
 '<section class="mgmt-alerts recv-coverage"><h3>CONFERÊNCIA DOS CAMPOS DEVOLVIDOS PELO DSS</h3>'+
 '<p>Estas contagens descrevem os registros carregados, não comprovam pagamentos. Para conferir pagamentos, consulte também a referência <strong>Pagamento (P)</strong>, que retorna apenas as parcelas pagas no período de pagamento.</p>'+
 '<div class="recv-coverage-grid">'+
 '<div><strong>Valor do pagamento</strong><span>'+num(summary.paymentFieldCoverage.positive)+' positivos · '+num(summary.paymentFieldCoverage.zero)+' zeros · '+num(summary.paymentFieldCoverage.missing)+' ausentes</span></div>'+
 '<div><strong>Saldo pendente</strong><span>'+num(summary.residualFieldCoverage.positive)+' positivos · '+num(summary.residualFieldCoverage.zero)+' zeros · '+num(summary.residualFieldCoverage.missing)+' ausentes</span></div>'+
 '<div><strong>Tipo de fatura</strong><span>'+num(summary.count-summary.missingTypes)+' preenchidos · '+num(summary.missingTypes)+' ausentes</span></div></div>'+
 '<p>O saldo pendente e o valor já pago são informações diferentes e aparecem em gráficos separados. Se os campos vierem zerados ou ausentes, é necessário confirmar a resposta original do DSS.</p></section>'+
 agingTable(summary.aging)+
 '<p class="ins-hint">Aviso: vencidas com saldo usa data de vencimento e valor residual confirmado na API. Valores nominais não são somados como pagamentos nem como saldo. Para interpretar inconsistências, consulte o DSS. Não significa inadimplência confirmada.</p>'+
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
