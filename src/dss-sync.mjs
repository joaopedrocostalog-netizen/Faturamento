/** A URL do Render não é segredo; NUNCA colocar o token DSS no bundle público. */
export const FATURAMENTO_RENDER_API='https://faturamento-sq74.onrender.com';
export async function fetchAuthorizedDocuments({token,from,to,fetchImpl=fetch,apiUrl=FATURAMENTO_RENDER_API}){
 if(typeof token!=='string'||token.trim().length<12)throw Error('Informe um token privado válido para sincronizar.');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(from)||!/^\d{4}-\d{2}-\d{2}$/.test(to)||from>to)
  throw Error('Selecione um período válido nos filtros antes de sincronizar.');
 const endpoint=new URL('/api/documentos-eletronicos',apiUrl);
 endpoint.searchParams.set('from',from);endpoint.searchParams.set('to',to);
 let response;
 try{
  response=await fetchImpl(endpoint.toString(),{
   method:'GET',headers:{Authorization:'Bearer '+token.trim(),Accept:'application/json'},
   cache:'no-store',credentials:'omit',redirect:'error',signal:AbortSignal.timeout(40000)
  });
 }catch(error){
  throw Error('Não foi possível conectar ao Render. Confira a internet, a implantação e tente novamente.');
 }
 let payload;
 try{payload=await response.json();}catch{throw Error('O Render retornou uma resposta inválida.');}
 if(response.status===401)throw Error('Token não autorizado no Render. Confira DSS_NFSE_SYNC_TOKEN em Environment.');
 if(response.status===403)throw Error(String(payload.error||'Sem permissão para consultar documentos DSS.'));
 if(!response.ok)throw Error(String(payload.error||'Falha no Render (HTTP '+response.status+').').slice(0,230));
 if(!payload||!Array.isArray(payload.registros))throw Error('O Render não retornou registros de documentos válidos.');
 return payload.registros;
}

/** Consulta autenticada e exclusiva de leitura para as abas do Faturamento. */
export async function fetchAuthorizedOverview({token,from,to,fetchImpl=fetch,apiUrl=FATURAMENTO_RENDER_API}){
 if(typeof token!=='string'||token.trim().length<12)throw Error('Informe um token privado válido para sincronizar.');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(from)||!/^\d{4}-\d{2}-\d{2}$/.test(to)||from>to)
  throw Error('Selecione um período válido nos filtros.');
 const endpoint=new URL('/api/overview',apiUrl);
 endpoint.searchParams.set('from',from);endpoint.searchParams.set('to',to);
 endpoint.searchParams.set('refresh','recent');endpoint.searchParams.set('sync_to',to);
 let response;
 try{
  response=await fetchImpl(endpoint.toString(),{method:'GET',
   headers:{Authorization:'Bearer '+token.trim(),Accept:'application/json'},
   cache:'no-store',credentials:'omit',redirect:'error',signal:AbortSignal.timeout(90000)});
 }catch{throw Error('Falha de rede ou tempo limite ao consultar faturamento no Render.');}
 let payload;
 try{payload=await response.json();}catch{throw Error('Resposta inválida do Render ao consultar faturamento.');}
 if(response.status===401)throw Error('Token de sincronização não autorizado no Render.');
 if(!response.ok)throw Error(String(payload?.error||'Erro HTTP '+response.status+' no DSS.').slice(0,230));
 if(!payload?.data||!Array.isArray(payload.data.viagens)||!Array.isArray(payload.data.pedidos))
  throw Error('O Render devolveu dados de faturamento incompletos.');
 return payload;
}

/** Proxy autorizado para Contas a Receber; segredo nunca é salvo no navegador. */
export async function fetchAuthorizedReceivables({token,from,to,tipoRef='E',fetchImpl=fetch,apiUrl=FATURAMENTO_RENDER_API}){
 if(typeof token!=='string'||token.trim().length<12)throw Error('Informe um token privado válido para consultar Contas a Receber.');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(from)||!/^\d{4}-\d{2}-\d{2}$/.test(to)||from>to)throw Error('Informe datas válidas.');
 if(!['E','V','P'].includes(tipoRef))throw Error('Referência inválida: use E, V ou P.');
 const url=new URL('/api/receivables',apiUrl);
 url.searchParams.set('from',from);url.searchParams.set('to',to);url.searchParams.set('tipo_ref',tipoRef);
 let response;
 try{
  response=await fetchImpl(url.toString(),{method:'GET',
   headers:{Authorization:'Bearer '+token.trim(),Accept:'application/json'},
   cache:'no-store',credentials:'omit',redirect:'error',signal:AbortSignal.timeout(60000)});
 }catch{throw Error('Falha de rede ou tempo limite ao consultar Contas a Receber no Render.');}
 let payload;
 try{payload=await response.json();}catch{throw Error('O Render retornou dados inválidos em Contas a Receber.');}
 if(response.status===401)throw Error('Token DSS não autorizado no Render.');
 if(!response.ok)throw Error(String(payload?.error||'Falha na consulta (HTTP '+response.status+').').slice(0,230));
 if(!Array.isArray(payload?.registros))throw Error('Retorno sem lista de parcelas.');
 return payload.registros;
}
