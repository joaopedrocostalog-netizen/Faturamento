/** Indicadores gerenciais calculados exclusivamente dos campos conhecidos da API DSS.
 * Nenhuma métrica aqui é lucro, recebimento, inadimplência ou status fiscal validado.
 */
import {receivablesSummary} from './receivables.mjs';
import {receivablesByCompany} from './companies.mjs';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const money=v=>Number.isFinite(v)?new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:2}).format(v):'—';
const n=v=>new Intl.NumberFormat('pt-BR').format(v);
const norm=v=>String(v??'').trim()||'Não informado';
const safeKey=v=>norm(v);
const memo=new WeakMap();
export function managerialMetrics(documents,orders=[]){
 if(!Array.isArray(documents))return managerialMetrics([],orders);
 let hit=memo.get(documents);
 if(hit&&hit.orders===orders)return hit.data;
 const groups={operacoes:new Map(),parceiros:new Map(),situacoes:new Map(),modelos:new Map(),apoios:new Map(),meses:new Map()};
 let valorFinal=0,knownFinal=0,iss=0,knownIss=0,withNfse=0,withFatura=0,semNfse=0,semFatura=0;
 function add(map,key,doc){
  const k=safeKey(key),g=map.get(k)||{name:k,count:0,value:0,known:0,iss:0,issKnown:0};
  g.count++;if(Number.isFinite(doc.valorFinal)){g.value+=doc.valorFinal;g.known++;}
  if(Number.isFinite(doc.totalIss)){g.iss+=doc.totalIss;g.issKnown++;}
  map.set(k,g);
 }
 for(const d of documents){
  if(d.numeroNfse)withNfse++;else semNfse++;
  if(d.fatura)withFatura++;else semFatura++;
  if(Number.isFinite(d.valorFinal)){knownFinal++;valorFinal+=d.valorFinal;}
  if(Number.isFinite(d.totalIss)){knownIss++;iss+=d.totalIss;}
  add(groups.operacoes,d.tipoOperacao,d);add(groups.parceiros,d.parceiro,d);
  add(groups.situacoes,d.status,d);add(groups.modelos,d.modelo,d);
  add(groups.apoios,d.pontoApoio,d);
  if(/^\d{4}-\d{2}/.test(d.dataEmissao||''))add(groups.meses,d.dataEmissao.slice(0,7),d);
 }
 const arr=(map,by='value')=>[...map.values()].sort((a,b)=>b[by]-a[by]||b.count-a.count||a.name.localeCompare(b.name,'pt-BR'));
 const figures=Object.fromEntries(Object.entries(groups).map(([k,v])=>[k,arr(v,k==='situacoes'||k==='modelos'?'count':'value')]));
 const result={count:documents.length,valorFinal,knownFinal,iss,knownIss,withNfse,semNfse,withFatura,semFatura,
  ticket:knownFinal?valorFinal/knownFinal:null,orderCount:orders.length,
  ...figures};
 memo.set(documents,{orders,data:result});return result;
}
const kpi=(label,value,sub)=>'<article class="kpi"><div class="kpi-label">'+esc(label)+'</div><div class="kpi-value">'+esc(value)+'</div><div class="kpi-sub">'+esc(sub)+'</div></article>';
function chart(title,subtitle,records,{moneyAxis=true,top=7,clickKind=''}={}){
 const rows=records.slice(0,top),max=Math.max(0,...rows.map(x=>moneyAxis?x.value:x.count));
 return '<section class="mgmt-chart"><div class="mgmt-chart-head"><h3>'+esc(title)+'</h3><small>'+esc(subtitle)+'</small></div>'+
 (rows.length?'<div class="mgmt-bars">'+rows.map((r,i)=>{
  const value=moneyAxis?r.value:r.count;
  const width=max>0?Math.max(1.4,value/max*100):0;
  const label=moneyAxis?money(value):n(value);
  return '<div class="mgmt-bar-row"><div class="mgmt-bar-top"><span title="'+esc(r.name)+'">'+esc(r.name)+'</span><strong>'+esc(label)+'</strong></div>'+
   '<div class="mgmt-bar-track"><div class="mgmt-bar-fill" role="img" aria-label="'+esc(r.name+': '+label)+'" style="width:'+width.toFixed(2)+'%"></div></div>'+
   '<small>'+n(r.count)+' documento(s)'+(moneyAxis?' · '+n(r.known)+' com valor informado':'')+'</small></div>';
 }).join('')+'</div>':'<p class="ins-hint">Nenhum registro disponível para este gráfico.</p>')+'</section>';
}
function trend(records){
 const sorted=[...records].sort((a,b)=>a.name.localeCompare(b.name));
 return chart('Evolução mensal do valor final','Soma por mês da data de emissão; sem inferir recebimento',sorted,{top:36});
}
export function renderManagerialDashboard(documents,orders=[],state={}){
 const s=managerialMetrics(documents,orders),live=state.docsSource==='live';
 const receivable=state.recvSource==='live'?receivablesSummary(receivablesByCompany(state.recvRows||[],state.recvCompany||'all')):null;
 const source=live?'Dados consultados no DSS':'Demonstração: valores e parceiros fictícios';
 const missing=[
  ['Sem número NFS-e',s.semNfse,'Verificar preenchimento, não concluir ausência de emissão'],
  ['Sem fatura informada',s.semFatura,'Conferir referência da fatura, não concluir inadimplência'],
  ['Valor final ausente',s.count-s.knownFinal,'Conferir o campo valor_final na origem'],
  ['ISS não informado',s.count-s.knownIss,'Conferir o campo total_iss na origem']
 ];
 return '<section class="ins-module mgmt-dashboard"><div class="section-title"><h2>VISÃO GERENCIAL DSS</h2><span>'+esc(source)+'</span></div>'+
 '<p class="mgmt-intro">Leitura operacional e fiscal dos documentos eletrônicos, agrupados por tipo de operação, parceiro, situação, modelo, ponto de apoio e mês. Os gráficos usam somente os campos realmente fornecidos pela API. <strong>A API de documentos eletrônicos não contém campo empresa:</strong> ela não permite separar NFS-e por estas quatro empresas com segurança; o filtro por empresa aplica-se apenas aos cartões de Contas a Receber.</p>'+
 '<div class="kpis">'+kpi('DOCUMENTOS',n(s.count),'Registros retornados')+
 kpi('VALOR FINAL INFORMADO',s.knownFinal?money(s.valorFinal):'—',n(s.knownFinal)+' documentos com valor')+
 kpi('ISS INFORMADO',s.knownIss?money(s.iss):'—',n(s.knownIss)+' documentos com ISS')+
 kpi('TICKET MÉDIO',money(s.ticket),'Apenas registros com valor final conhecido')+
 kpi('COM NFS-e',n(s.withNfse),'Referência preenchida')+
 kpi('COM FATURA',n(s.withFatura),'Não significa valor recebido')+
 (receivable?kpi('SALDO RESIDUAL A RECEBER',receivable.residualKnown?money(receivable.residual):'—','DSS Contas a Receber; '+n(receivable.residualKnown)+' saldos conhecidos'):'')+
 (receivable?kpi('PARCELAS VENCIDAS COM SALDO',n(receivable.lateCount),'Vencimento passado e valor residual positivo'):'')+
 '</div>'+
 '<div class="mgmt-chart-grid">'+trend(s.meses)+chart('Valor por tipo de operação','Soma do valor_final informado',s.operacoes)+
 chart('Principais parceiros','Valor final de documentos por parceiro',s.parceiros)+
 chart('Documentos por situação','Classificação textual recebida do DSS',s.situacoes,{moneyAxis:false,top:10})+
 chart('Valor por ponto de apoio','Concentração por unidade/ponto de apoio',s.apoios)+
 chart('Documentos por modelo','Quantidade agrupada pelo campo modelo',s.modelos,{moneyAxis:false})+'</div>'+
 '<section class="mgmt-alerts"><h3>CONFERÊNCIAS SUGERIDAS</h3><p>Essas sinalizações indicam campos ausentes nos registros consultados, não irregularidades comprovadas.</p>'+
 '<div class="mgmt-alert-grid">'+missing.map(([label,count,note])=>'<article><strong>'+n(count)+'</strong><span>'+esc(label)+'</span><small>'+esc(note)+'</small></article>').join('')+'</div></section>'+
 '<section class="mgmt-fields"><h3>COBERTURA DOS CAMPOS DA API</h3><p>11 campos de documento: ID, parceiro, tipo de operação, número NFS-e, modelo, status, data de emissão, valor final, total de ISS, fatura e ponto de apoio. Todos são utilizados na visão gerencial ou na aba Documentos / NFS-e.</p></section>'+
 '<div class="v-bottom-actions"><button class="btn btn-red" data-nav="receber">DETALHAR CONTAS A RECEBER →</button></div>'+
 '<p class="ins-hint">Não somar automaticamente valor final de NFS-e ao frete de pedidos: as fontes podem representar a mesma operação. Pagamento, lucro, vencimento, inadimplência e validação fiscal exigem outras fontes.</p></section>';
}
