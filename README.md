# COSTALOG — Faturamento & Financeiro

Aplicação financeira separada do projeto [Viagens-PF](https://github.com/joaopedrocostalog-netizen/Viagens-PF), com os mesmos arquivos-base e identidade visual preto/vermelho/branco da COSTALOG, adaptada do ZIP fornecido.

## Abas
- **Painel financeiro:** valores de fretes de pedidos, volume de pedidos, liberações, faturas e ticket médio.
- **Faturamento:** conferência de liberação, número de fatura, entrega, comprovantes e valores a receber.
- **Pedidos / CT-e:** consulta de documentos e valores.
- **Clientes / Fretes:** dados financeiros por cliente.
- **Análises financeiras:** evolução mensal, tipos de serviço, ranking e valores.
- **Comparativos:** períodos A/B e indicadores financeiros consultados no DSS.
- **Relatórios financeiros:** exportações XLSX, CSV e impressão/PDF de pedidos, CT-e e clientes.

A navegação não publica as áreas de viagens, frota, rotas, motoristas, MDF-e, ocorrências ou administração.

## Segurança e fonte de dados
A navegação exige permissão **financeiro** ou **administrador** reconhecida pelo servidor. Sem login, ou com perfil operacional, a aplicação mostra somente a tela de acesso restrito. O backend existente valida login e acesso DSS; a interface nunca deve conter usuário/senha DSS, segredo de sessão ou senha MariaDB.

Por padrão, `src/site-config.mjs` mantém o endpoint HTTPS de backend já presente no projeto original (`https://viagens-pf.onrender.com`). Isso **reutiliza um serviço externo existente**: login e DSS funcionarão somente se o serviço estiver ativo, o usuário tiver permissão e CORS permitir a origem da página. Se for implantar API própria (Plesk/Render), altere `API_BASE_URL` para a origem privada publicada em HTTPS e configure segredos exclusivamente no servidor.

**Observação:** valor de frete lançado, flag liberado para faturamento e número de fatura não provam recebimento, liquidação ou emissão fiscal confirmada. Campos ausentes não devem ser tratados como zero.

## Executar e publicar
- Frontend: `python -m http.server 8080` (abrir `http://localhost:8080`).
- Backend opcional independente: copie `.env.example` para `.env` **somente no servidor privado**; configure DSS, contas e MariaDB conforme a infraestrutura; use Node.js 20+, `npm install` e `npm start`.
- Testes: `npm test`.
- GitHub Pages: em **Settings > Pages**, selecione **GitHub Actions**. O workflow publica somente arquivos do frontend; o GitHub Pages não executa Node.js, MariaDB nem API DSS.

O arquivo `.env` real não deve ser enviado para o GitHub.