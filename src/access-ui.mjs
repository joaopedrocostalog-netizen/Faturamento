/** Regras visuais: segurança real é aplicada em api/access.mjs no servidor. */
/** Portal de faturamento: preservar os módulos financeiros para reutilização futura.
 * Ao criar o site Financeiro, basta habilitar SHOW_FINANCE_ONLY_TABS na cópia do projeto.
 * Esta flag controla navegação e blocos incorporados no Painel.
 */
export const SHOW_FINANCE_ONLY_TABS = false;
export const HIDDEN_FINANCE_VIEWS = ['analises','relatorios'];
export const FIN_VIEWS=['painel','faturamento','ctes','clientes','analises','comparativos','relatorios'];
export const VISIBLE_VIEWS=SHOW_FINANCE_ONLY_TABS?FIN_VIEWS:FIN_VIEWS.filter(view=>!HIDDEN_FINANCE_VIEWS.includes(view));
export function permittedView(role,view){return ['financeiro','administrador'].includes(role)&&VISIBLE_VIEWS.includes(view);}
export function reportTypesFor(role){return ['financeiro','administrador'].includes(role)?['pedidos','ctes','clientes']:[];}
export function secureReport(report,type,role){
 if(!reportTypesFor(role).includes(type))throw Error('Relatório não permitido para este perfil.');
 if(role==='financeiro'||role==='administrador')return report;
 throw Error('Acesso financeiro necessário.');
}
export function safeView(role,view){return permittedView(role,view)?view:permittedView(role,'painel')?'painel':'acesso';}
