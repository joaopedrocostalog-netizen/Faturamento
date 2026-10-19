/** Regras visuais: segurança real é aplicada em api/access.mjs no servidor. */
/** Aplicação exclusiva da área financeira. O backend continua validando as permissões. */
export const FIN_VIEWS=['painel','faturamento','ctes','clientes','analises','comparativos','relatorios'];
export function permittedView(role,view){return ['financeiro','administrador'].includes(role)&&FIN_VIEWS.includes(view);}
export function reportTypesFor(role){return ['financeiro','administrador'].includes(role)?['pedidos','ctes','clientes']:[];}
export function secureReport(report,type,role){
 if(!reportTypesFor(role).includes(type))throw Error('Relatório não permitido para este perfil.');
 if(role==='financeiro'||role==='administrador')return report;
 throw Error('Acesso financeiro necessário.');
}
export function safeView(role,view){return permittedView(role,view)?view:permittedView(role,'painel')?'painel':'acesso';}
