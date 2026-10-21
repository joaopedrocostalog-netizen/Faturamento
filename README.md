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

## Visão Gerencial DSS (acessível no menu principal)
A aba **Visão Gerencial** é aberta para todos os visitantes do portal (a consulta de dados reais segue exigindo token de sincronização privado). Apresenta cartões de documentos, valor final, ISS, ticket médio, quantidade com número NFS-e e com fatura, além de gráficos de evolução mensal, tipo de operação, parceiros, status, modelo e ponto de apoio. O Painel oferece atalho para a nova aba. Para não prejudicar o desempenho anual, os dados são agregados com cache e cada gráfico exibe apenas os maiores grupos, sem biblioteca gráfica adicional.

A tabela **Documentos / NFS-e** ganhou filtros por tipo de operação e ponto de apoio, mantém a pesquisa e ordenação e agora mostra também o ID do DSS. Foram cobertos os 11 campos conhecidos no esquema da rota. Importante: usar 100% dos **campos documentados** não significa que o DSS não possua outras rotas/campos. O agrupamento por status é descritivo e não substitui a validação fiscal; valor final não é receita recebida. Não somar automaticamente NFS-e a pedidos PF (pode haver dupla contagem). Recomendações para evoluir: autenticação corporativa/SSO, paginação de rede, vencimento e status financeiro de faturas via API específica, conciliação por chave de documento e trilha de auditoria.

## Contas a Receber — DSS tms_financeiro
A nova aba **Contas a Receber** lista parcelas com os **34 campos** documentados no Swagger, com filtros, paginação de 25 registros, detalhes por linha, saldos residuais, pagamentos informados, vencidas com saldo e agrupamentos de parceiro, situação, mês de vencimento e tipo de fatura. O Painel e a Visão Gerencial mostram indicadores adicionais somente se as parcelas vierem do DSS.

**Configuração necessária:** Render → Environment → `DSS_RECEIVABLES_PATH` com o **caminho GET exato** da operação "Parcelas a receber no período". Este caminho **não aparece** no JSON enviado e não deve ser adivinhado. O backend usa `DSS_BASE_URL`, `DSS_AUTH_TYPE`, `DSS_USERNAME` / `DSS_PASSWORD` já configurados e formata datas como `dd/mm/aaaa`; `tipo_ref=E` (emissão), `V` (vencimento), `P` (pagamento, apenas pagas). É necessário que o usuário DSS tenha acesso ao módulo **tms_financeiro**.

Durante a sincronização geral, o portal tenta carregar `tipo_ref=E` em paralelo com os documentos fiscais e pedidos. Caso falhe, o Faturamento continua utilizável, e a aba de recebíveis mostra um aviso. A aba permite uma consulta independente E/V/P com token de leitura no Render; isso não altera os demais dados. O token é utilizado só na chamada e não é persistido no navegador.

**Interpretação gerencial:** valores de parcelas, pagamentos e saldos residuais não devem ser somados a pedidos ou NFS-e (possível duplicação). `Vencidas com saldo` é calculado apenas quando há vencimento anterior à data atual e `valorResidual>0`, sem concluir inadimplência contratual. O status da fatura é exibido exatamente conforme a API. Um campo ausente continua “—”.

**Correção do site no Render:** o servidor inclui explicitamente os módulos usados pelo frontend na lista estática. Foram incluídos `managerial-ui.mjs`, `receivables.mjs` e `receivables-ui.mjs` para que os imports ES funcionem no navegador.

## Diagnóstico de consultas longas em Contas a Receber
Uma consulta anual em `/listarContasReceber` pode ultrapassar o timeout do DSS. A partir desta versão, a interface consulta intervalos mensais com uma requisição por vez. Se uma consulta mensal estourar o tempo, divide somente aquele mês em dois intervalos menores. A tela mostra o progresso; os dados são aplicados **somente após todos os meses serem recebidos com sucesso**. No Render, `DSS_RECEIVABLES_TIMEOUT_MS` (padrão 55.000 ms, máximo 60.000 ms) é independente do timeout das APIs de RV/PF. Logs agora distinguem DNS, conexão e tempo limite, sem registrar credenciais nem linhas fiscais. Se até intervalos de 15 dias falharem por conexão, verificar IP de saída/allowlist ou disponibilidade da DSS com o suporte do fornecedor.

## Qualidade dos campos de Contas a Receber (DSS)
O DSS pode marcar uma parcela como **Pago** mas fornecer `valorPagamento=0`, ou marcar **Aberto** com `valorResidual=0`. Esses campos são preservados sem transformação: **status não prova valor pago, e valor da parcela não é o mesmo que saldo residual**. A tela de recebíveis sinaliza quantos registros têm essas combinações e quantos não possuem `tipoFatura`. Se a soma de saldos residuais for zero, os gráficos alternam explicitamente para **valor nominal das parcelas** (se preenchido) ou **quantidade** (quando nem valores nominais estão disponíveis); não apresentam valor nominal como saldo confirmado. Na falta de tipo de fatura, o gráfico usa centro de custo com rótulo explícito, sem inferir tipo de operação. Os 34 campos do Swagger aceitam nomes em camelCase, snake_case, PascalCase e aliases estritos (por exemplo `valorPago`, `valorRecebido`, `valorParcela`, `saldoResidual`, `tipo_de_fatura`). Nenhum zero explícito é substituído. Foi incluído quadro de faixas de vencimento: a vencer, 1–30, 31–60, 61–90, mais de 90 dias e sem vencimento, separando saldo residual informado do nominal.

## Conferência DSS de Contas a Receber e vencimentos
O gráfico de saldo residual NÃO é o valor recebido. A aba agora separa os pagamentos informados pelo DSS (valorPagamento) do saldo residual (valorResidual). Mostra, por campo, contagens de zeros, positivos e ausentes, além da cobertura de tipoFatura. O backend registra somente contagens agregadas dos campos ORIGINAIS da API após a próxima consulta, sem dados pessoais ou valores monetários, para distinguir falha de mapeamento e ausência no DSS. A API contas a pagar NÃO foi utilizada: ela trata saídas de caixa e não completa valores recebidos de clientes.

A tabela de contas a receber exibe o vencimento na primeira coluna, inicialmente ordenada por prioridade: parcelas não quitadas vencidas, próximas, sem data, depois quitadas; filtros rápidos para vencidas com saldo confirmado, vencimentos em 7 dias, não quitadas, pagas e divergências. Clique nas colunas para ordenar. O filtro tipo_ref P consulta somente as parcelas pagas pelo período de pagamento, e não deve ser mesclado automaticamente às consultas E ou V.

## Empresas: segmentação de recebíveis
O campo `empresa` do DSS é usado para separar as parcelas entre **A.C DA COSTA DELIBERALI**, **COMEX COSTA LOG**, **CRC COSTA** e **IDEALLOG**. Valores brutos sem correspondência inequívoca ficam em "Outras / não identificadas" — não usamos `parceiro` como empresa. O seletor de empresa fica visível no Painel, na Visão Gerencial e em Contas a Receber e afeta os indicadores que vêm da API financeira. A aba Contas a Receber inclui um quadro financeiro detalhado separado por empresa. A API de NFS-e documentada não traz `empresa`; não atribuímos suas notas a uma empresa sem uma chave explícita e confiável.
O Swagger principal de DSS fica em `/wsdss/docs`, mas seu catálogo OpenAPI não estava acessível externamente durante esta atualização: para descobrir APIs adicionais que complementem tipos de fatura e comprovantes de recebimento, pedir ao fornecedor o OpenAPI JSON, lista de rotas disponíveis ou instruções sobre `tipo_ref=P` e `tipoFatura`. Não é seguro supor endpoints.
