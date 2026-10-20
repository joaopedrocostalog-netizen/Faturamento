/** Proxy DSS restrito para o endpoint de documentos eletrônicos / NFS-e. */
import {normalizeElectronicDocuments,validDate,dateToDss} from '../src/e-documents.mjs';
export class DocumentQueryError extends Error{
 constructor(message,status=502){super(message);this.name='DocumentQueryError';this.status=status;}
}
export async function queryElectronicDocuments({env=process.env,from='',to='',fetchImpl=fetch}={}){
 if(Boolean(from)!==Boolean(to))throw new DocumentQueryError('Informe as duas datas ou deixe ambas vazias.',400);
 if(from&&(!validDate(from)||!validDate(to)||from>to))
  throw new DocumentQueryError('Intervalo inválido; use AAAA-MM-DD, com a data inicial anterior à final.',400);
 const base=String(env.DSS_BASE_URL||'').trim(),path=String(env.DSS_DOCUMENTOS_PATH||'').trim();
 if(!base||!path)throw new DocumentQueryError('Configure DSS_BASE_URL e DSS_DOCUMENTOS_PATH no Render (rota real do Swagger).',503);
 if(!/^\/(?!\/)[a-z0-9_\-/]+$/i.test(path)||path.includes('..'))
  throw new DocumentQueryError('DSS_DOCUMENTOS_PATH inválido; informe um caminho relativo começando com /.',503);
 let url,origin;try{
  const root=new URL(base),urlBase=base.replace(/\/?$/,'/');
  if(root.protocol!=='https:'&&!['localhost','127.0.0.1'].includes(root.hostname))throw Error();
  origin=root.origin;url=new URL(path.slice(1),urlBase);
  if(url.origin!==origin)throw Error();
 }catch{throw new DocumentQueryError('DSS_BASE_URL inválida.',503);}
 if(from&&to){url.searchParams.set('data_inicio',dateToDss(from));url.searchParams.set('data_fim',dateToDss(to));}
 const authType=String(env.DSS_AUTH_TYPE||'basic').toLowerCase(),headers={Accept:'application/json'};
 if(authType==='basic'){
  if(!env.DSS_USERNAME||!env.DSS_PASSWORD)throw new DocumentQueryError('DSS_USERNAME e DSS_PASSWORD não configurados no Render.',503);
  if(String(env.DSS_USERNAME).includes(':'))throw new DocumentQueryError('DSS_USERNAME inválido.',503);
  headers.Authorization='Basic '+Buffer.from(env.DSS_USERNAME+':'+env.DSS_PASSWORD).toString('base64');
 }else if(authType==='header'){
  const key=env.DSS_AUTH_HEADER;
  if(!/^[a-zA-Z0-9-]{1,80}$/.test(key||'')||!env.DSS_AUTH_VALUE)throw new DocumentQueryError('Credenciais Header DSS ausentes.',503);
  headers[key]=env.DSS_AUTH_VALUE;
 }else throw new DocumentQueryError('DSS_AUTH_TYPE deve ser basic ou header.',503);
 let res;
 try{res=await fetchImpl(url,{method:'GET',headers,redirect:'error',signal:AbortSignal.timeout(Math.min(60000,Math.max(2000,Number(env.DSS_TIMEOUT_MS)||25000))) });}
 catch{throw new DocumentQueryError('Não foi possível consultar o DSS (rede ou tempo limite).',502);}
 if(res.status===401)throw new DocumentQueryError('O DSS recusou as credenciais. Confira usuário/senha.',502);
 if(res.status===403)throw new DocumentQueryError('DSS negou acesso. Verifique se o módulo tms_faturamento está habilitado.',403);
 if(res.status===404)throw new DocumentQueryError('Endpoint DSS não encontrado. Confira DSS_DOCUMENTOS_PATH.',502);
 if(!res.ok)throw new DocumentQueryError('Consulta DSS retornou HTTP '+res.status+'.',502);
 let result;
 try{result=await res.json();}catch{throw new DocumentQueryError('Resposta DSS não é JSON válido.',502);}
 if(Number(result?.status)===403)throw new DocumentQueryError('Módulo tms_faturamento não habilitado na conta DSS.',403);
 if(Number(result?.status)===401)throw new DocumentQueryError('DSS rejeitou a autenticação.',502);
 if(Number(result?.status)===400)throw new DocumentQueryError('DSS rejeitou o filtro: '+String(result?.mensagemErro||'erro de validação').slice(0,160),400);
 if(Number(result?.status)!==200)throw new DocumentQueryError('DSS respondeu com erro '+String(result?.status??'desconhecido')+'.',502);
 let rows;
 try{rows=normalizeElectronicDocuments(result);}
 catch(e){throw new DocumentQueryError(e.message,502);}
 const max=Math.min(10000,Math.max(1,Number(env.DSS_DOCUMENTOS_MAX_REGISTROS)||5000));
 if(rows.length>max)throw new DocumentQueryError('Resposta ultrapassou o limite de '+max+' documentos; selecione período menor.',413);
 return {status:200,source:'dss',from:from||null,to:to||null,qtd_registros:rows.length,registros:rows};
}
