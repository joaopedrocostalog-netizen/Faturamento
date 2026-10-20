# COSTALOG | Faturamento

Portal web de faturamento da COSTALOG, construído sobre a mesma interface visual do projeto Viagens-PF, mantendo as cores, logotipo, filtros, comparativos e recursos de exportação.

## Acesso livre (sem senha)
Ao abrir o site, o visitante entra **diretamente no Painel**, com seis abas visíveis:
- Painel
- Faturamento
- Documentos / NFS-e
- Pedidos / CT-e
- Clientes / Fretes
- Comparativos

As abas **Análises financeiras** e **Relatórios financeiros** estão ocultas, inclusive seus atalhos e os gráficos de análises incorporados no Painel. O código delas permanece no repositório para o futuro site **Financeiro**. Para reabilitá-las na cópia do projeto, altere `SHOW_FINANCE_ONLY_TABS` para `true` em `src/access-ui.mjs`.

**Não há formulário de login, senha, conta de usuário ou tela de acesso restrito na interface publicada.** Os relatórios do modo demonstração podem ser exportados.

## Fonte de dados e privacidade
Este repositório e o endereço GitHub Pages são **públicos**. Por esse motivo, a versão sem senha utiliza **exclusivamente dados fictícios de demonstração**, inclusive no painel e nos relatórios. **Não publica dados financeiros reais da COSTALOG.**

O backend DSS, o MariaDB e as credenciais do portal principal permanecem separados. Para exibir dados reais sem formulário de login no frontend, é preciso antes definir uma arquitetura segura com restrição de rede (VPN/intranet) ou autenticação transparente aplicada pelo servidor, de modo que pessoas externas não possam consultar informações financeiras. Nunca inserir segredo, token ou senha no código JavaScript público.

## Uso
- Site: https://joaopedrocostalog-netizen.github.io/Faturamento/
- Repositório: https://github.com/joaopedrocostalog-netizen/Faturamento
- Desenvolvimento local: `python -m http.server 8080` e abrir `http://localhost:8080/`
- Testes: `npm test`
- Implantação: workflow `.github/workflows/pages.yml` (GitHub Actions → GitHub Pages).

O backend de referência está incluído para futura adaptação privada, **mas não é usado pelo frontend público sem senha**.

## Documentos eletrônicos / NFS-e
A nova aba traz pesquisa, filtro por emissão, listagem, totais de valor final e ISS, faturas e exportação CSV. O GitHub Pages mostra **somente exemplos fictícios**.

O backend dispõe de `GET /api/documentos-eletronicos` autenticado. O serviço está descrito em [INTEGRACAO_DOCUMENTOS_NFSE.md](./INTEGRACAO_DOCUMENTOS_NFSE.md), e o [render.yaml](./render.yaml) define o Blueprint para o Render. A rota específica da operação no DSS precisa ser confirmada no Swagger antes de consultas reais. Nenhuma credencial deve ser colocada no frontend público.

## Sincronização global com DSS
O único botão **SINCRONIZAR COM DSS** está ao lado das datas, em todas as abas do Faturamento. Ele solicita um token privado com permissão **exclusivamente de consulta** e atualiza em uma mesma operação: Painel, Faturamento, Documentos / NFS-e, Pedidos / CT-e, Clientes / Fretes e Comparativos.

- A consulta utiliza o serviço protegido no Render e as mesmas datas para documentos fiscais e relatórios de frete/pedidos.
- O frontend faz consultas mensais de pedidos/RVs (até 12 meses) em paralelo, limitando o número de requisições, e consulta NFS-e. Só substitui o conjunto de dados após todas as consultas terminarem sem erro.
- O token `DSS_NFSE_SYNC_TOKEN` (mínimo 32 caracteres) é usado via Bearer apenas em `GET /api/documentos-eletronicos` e `GET /api/overview`. Não autoriza administração, cadastro de usuários, diagnóstico ou endpoints de registros.
- As demais credenciais DSS ficam nas variáveis privadas do Render. O token de sincronização não é salvo em localStorage ou sessão do navegador.
- Quando o período é alterado, todos os dados sincronizados são descartados e o portal volta ao modo demonstração, evitando a mistura de informações de períodos diferentes.
- Ao falhar qualquer consulta, o site informa o erro e mantém o conjunto anterior, sem declarar a nova sincronização concluída.
- A pesquisa separada dos filtros de data é contextual: pedido/fatura, NFS-e/parceiro, CT-e e clientes. A ordenação das tabelas pode ser alterada clicando nas colunas. A NFS-e começa pelo maior valor final, com filtros de status, modelo, ordenação ascendente/descendente e paginação. O Faturamento prioriza o maior valor a receber.

**Privacidade:** o site do GitHub Pages permanece aberto sem login e usa dados fictícios antes de uma sincronização autorizada. Depois de sincronizar, a guia passa a exibir dados reais corporativos a quem estiver olhando a tela. Não compartilhe o token, não use o portal em dispositivos públicos e considere SSO/VPN para a versão corporativa definitiva.

### Preparação no Render
É necessário configurar `DSS_BASE_URL`, `DSS_USERNAME`, `DSS_PASSWORD`, `DSS_DOCUMENTOS_PATH` e `DSS_NFSE_SYNC_TOKEN`. Os endpoints `DSS_VIAGENS_PATH` e `DSS_PEDIDOS_PATH` devem corresponder às operações já utilizadas no portal Viagens-PF. A falta de qualquer fonte gera erro informativo, não dados fictícios apresentados como reais.

## Comparativo independente da sincronização geral

A consulta `CONSULTAR COMPARATIVO NO DSS` dentro da aba **Comparativos** é separada da ação `SINCRONIZAR COM DSS` do cabeçalho. Os períodos A e B permanecem como escolhidos pelo usuário mesmo depois da sincronização do site, sem herdar ou sofrer alteração pelas datas globais. A consulta pede o token privado somente no momento do uso, utiliza o backend protegido `GET /api/overview`, preenche apenas a tabela do comparativo e não altera pedidos, documentos ou indicadores das outras abas. A resposta deve conter todos os meses pedidos, ou nenhum resultado de comparação é aplicado. Os dados comparativos são mantidos apenas na memória da página, não no armazenamento local.

## Otimizações de desempenho para um ano de registros
A tabela de Faturamento e a de Documentos exibem apenas **25 linhas por página** (os registros do período continuam disponíveis em memória para ordenar e calcular indicadores). A **carteira de clientes** e os detalhes de cliente agora também exibem no máximo **25 itens de cada lista por página**, com botões Anterior/Próxima. Indicadores anuais, agregações por cliente e ordenações são memorizados enquanto o dataset e os filtros não mudam, evitando recalculá-los ao passar de página. A pesquisa usa espera de 180 ms entre digitações; os filtros avançados só são construídos quando são expandidos. A barra de andamento do DSS é atualizada sem reconstruir todo o DOM após cada mês consultado. A importação anual ainda recebe todos os meses necessários pelo backend para produzir totais corretos; a paginação evita montar os registros ocultos na tela, mas não é paginação de rede.
