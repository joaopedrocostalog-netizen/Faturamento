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
