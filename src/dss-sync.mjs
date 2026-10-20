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
 if(response.status===401)throw Error('Token não autorizado no Render. Confira PORTAL_ACCESS_TOKEN e PORTAL_ALLOW_LEGACY_TOKEN.');
 if(response.status===403)throw Error(String(payload.error||'Sem permissão para consultar documentos DSS.'));
 if(!response.ok)throw Error(String(payload.error||'Falha no Render (HTTP '+response.status+').').slice(0,230));
 if(!payload||!Array.isArray(payload.registros))throw Error('O Render não retornou registros de documentos válidos.');
 return payload.registros;
}
