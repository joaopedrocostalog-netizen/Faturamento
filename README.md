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

## Botão «Sincronizar com DSS» (Documentos / NFS-e)
O botão fica sempre visível em **Documentos / NFS-e**, inclusive no site aberto sem login. O visitante só vê exemplos fictícios até solicitar sincronização e informar, na janela de autorização, **um token privado do backend**. O token é usado apenas na requisição HTTPS e **não** é armazenado no navegador. O serviço Render `https://faturamento-sq74.onrender.com` exige Bearer autorizado e acesso com permissão Financeiro; somente os documentos NFS-e passam ao modo de dados reais depois de uma resposta HTTP 200 válida.

**Para habilitar a consulta:** configure **Environment → `DSS_NFSE_SYNC_TOKEN`** com uma sequência aleatória de pelo menos 32 caracteres. Este token só autoriza `/api/documentos-eletronicos`, não concede acesso administrativo nem libera as demais APIs. Se o backend já usa sessão pessoal com perfil Financeiro, ela também é aceita. Nunca use a senha DSS no formulário. `DSS_DOCUMENTOS_PATH`, `DSS_BASE_URL` e as credenciais DSS permanecem no Render. A origem GitHub Pages é permitida por CORS, mas nunca obtém dados sem Bearer autorizado.

Ao alterar o intervalo de datas depois de uma sincronização, o sistema limpa os dados reais carregados anteriormente e solicita nova consulta. Nenhuma outra aba passa a usar valores reais automaticamente. Se o token estiver errado ou o DSS falhar, a tela mostra o motivo e não declara sincronização bem-sucedida.
