/** Consulta somente leitura da operação DSS "Parcelas a receber no período".
 * DSS_RECEIVABLES_PATH vem do Swagger, nunca é deduzido pelo JSON.
 */
import {validDate,dateToDss} from '../src/e-documents.mjs';
import {normalizeReceivables} from '../src/receivables.mjs';
export class ReceivablesQueryError extends Error{
 constructor(message,status=502){super(message);this.name='ReceivablesQueryError';this.status=status;}
}
export async function queryReceivables({env=process.env,from='',to='',tipoRef='E',fetchImpl=fetch}={}){
 if(Boolean(from)!==Boolean(to))throw new ReceivablesQueryError('Informe as duas datas ou nenhuma.',400);
 if(from&&(!validDate(from)||!validDate(to)||from>to))throw new ReceivablesQueryError('Intervalo de datas inválido.',400);
 if(!['E','V','P'].includes(tipoRef))throw new ReceivablesQueryError('tipo_ref deve ser E, V ou P.',400);
 const base=String(env.DSS_BASE_URL||'').trim(),path=String(env.DSS_RECEIVABLES_PATH||'').trim();
 if(!path||!base)throw new ReceivablesQueryError('Configure DSS_RECEIVABLES_PATH com a rota exata do Swagger e DSS_BASE_URL no Render.',503);
 if(!/^\/(?!\/)[a-z0-9_/-]+$/i.test(path)||path.includes('..'))throw new ReceivablesQueryError('DSS_RECEIVABLES_PATH deve ser um caminho relativo válido começando por /.',503);
 let url;
 try{
  const b=new URL(base),prefix=base.replace(/\/?$/,'/');
  if(b.protocol!=='https:'&&!['localhost','127.0.0.1'].includes(b.hostname))throw Error();
  url=new URL(path.slice(1),prefix);
  if(url.origin!==b.origin)throw Error();
 }catch{throw new ReceivablesQueryError('DSS_BASE_URL inválida.',503);}
 if(from){url.searchParams.set('data_inicio',dateToDss(from));url.searchParams.set('data_fim',dateToDss(to));}
 url.searchParams.set('tipo_ref',tipoRef);
 const headers={Accept:'application/json'},authType=String(env.DSS_AUTH_TYPE||'basic').toLowerCase();
 if(authType==='basic'){
  if(!env.DSS_USERNAME||!env.DSS_PASSWORD)throw new ReceivablesQueryError('Credenciais DSS ausentes.',503);
  if(String(env.DSS_USERNAME).includes(':'))throw new ReceivablesQueryError('DSS_USERNAME inválido.',503);
  headers.Authorization='Basic '+Buffer.from(env.DSS_USERNAME+':'+env.DSS_PASSWORD).toString('base64');
 }else if(authType==='header'){
  if(!/^[a-zA-Z0-9-]{1,80}$/.test(env.DSS_AUTH_HEADER||'')||!env.DSS_AUTH_VALUE)throw new ReceivablesQueryError('Autenticação DSS por cabeçalho não configurada.',503);
  headers[env.DSS_AUTH_HEADER]=env.DSS_AUTH_VALUE;
 }else throw new ReceivablesQueryError('DSS_AUTH_TYPE inválido.',503);
 let res;
 const timeout=Math.min(60000,Math.max(5000,Number(env.DSS_RECEIVABLES_TIMEOUT_MS)||55000));
 const started=Date.now();
 try{
  res=await fetchImpl(url,{method:'GET',headers,redirect:'error',signal:AbortSignal.timeout(timeout)});
 }catch(e){
  // Não registrar URL, credenciais ou conteúdo fiscal nos logs.
  const code=String(e?.cause?.code||e?.code||''),name=String(e?.name||'');
  const isTimeout=/timeout|abort|UND_ERR_CONNECT_TIMEOUT|ETIMEDOUT/i.test(name+' '+code);
  const kind=isTimeout?'timeout':/ENOTFOUND|EAI_AGAIN/i.test(code)?'dns':
   /ECONNREFUSED|ECONNRESET|UND_ERR_SOCKET/i.test(code)?'connection':'network';
  console.warn('[DSS] receber consulta falhou',{kind,code:code.slice(0,45),elapsedMs:Date.now()-started,
   from:from||'today',to:to||'today',tipoRef});
  if(isTimeout)throw new ReceivablesQueryError('Tempo limite de '+Math.round(timeout/1000)+'s na consulta DSS de Contas a Receber. Tente um período menor.',504);
  if(kind==='dns')throw new ReceivablesQueryError('Não foi possível resolver o servidor DSS (DNS). Verifique conectividade e DSS_BASE_URL.',502);
  if(kind==='connection')throw new ReceivablesQueryError('A conexão com o DSS foi interrompida ou recusada. Verifique disponibilidade do fornecedor.',502);
  throw new ReceivablesQueryError('Falha de conexão entre Render e DSS. Confira acesso de rede e servidor.',502);
 }
 console.info('[DSS] receber retorno',{httpStatus:res.status,elapsedMs:Date.now()-started,
  from:from||'today',to:to||'today',tipoRef});
 if(res.status===401)throw new ReceivablesQueryError('Usuário ou senha DSS inválidos.',502);
 if(res.status===403)throw new ReceivablesQueryError('Acesso negado: este endpoint exige o módulo tms_financeiro no DSS.',403);
 if(res.status===404)throw new ReceivablesQueryError('Rota não encontrada. Confira DSS_RECEIVABLES_PATH no Swagger.',502);
 if(!res.ok)throw new ReceivablesQueryError('Erro HTTP '+res.status+' no DSS.',502);
 let data;
 try{data=await res.json();}catch{throw new ReceivablesQueryError('DSS não retornou JSON válido.',502);}
 if(Number(data?.status)===403)throw new ReceivablesQueryError('O DSS exige o módulo tms_financeiro habilitado.',403);
 if(Number(data?.status)===401)throw new ReceivablesQueryError('Autenticação DSS recusada.',502);
 if(Number(data?.status)===400)throw new ReceivablesQueryError('Filtro DSS recusado: '+String(data.mensagemErro||'erro de validação').slice(0,150),400);
 if(Number(data?.status)!==200)throw new ReceivablesQueryError('DSS retornou status '+String(data?.status??'desconhecido'),502);
 let records;
 try{records=normalizeReceivables(data);}catch(e){throw new ReceivablesQueryError(e.message,502);}
 const limit=Math.min(20000,Math.max(1,Number(env.DSS_RECEIVABLES_MAX_REGISTROS)||10000));
 if(records.length>limit)throw new ReceivablesQueryError('Limite de '+limit+' parcelas excedido; consulte intervalo menor.',413);
 return {status:200,source:'dss',tipoRef,from:from||null,to:to||null,qtd_registros:records.length,registros:records};
}