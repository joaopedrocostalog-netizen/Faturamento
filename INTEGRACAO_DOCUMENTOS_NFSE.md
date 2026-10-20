# Integração DSS — Documentos eletrônicos / NFS-e

## Informações confirmadas pelo esquema recebido
Filtros de consulta: `data_inicio` e `data_fim`, ambos `dd/mm/aaaa`. Sem datas, a API informa retornar todos os registros. Campos: `id`, `parceiro`, `tipo_operacao`, `numero_nfse`, `modelo`, `status`, `data_emissao`, `valor_final`, `total_iss`, `fatura`, `ponto_apoio`.

Respostas: 200 (lista), 400 (validação), 401 (credenciais), 403 (módulo `tms_faturamento` ausente ou sem permissão), 500 (DSS/servidor). A documentação compartilhada **não revela a rota completa**: é necessário obter o caminho no Swagger (linha GET imediatamente acima de 'Documentos eletrônicos').

## O que foi implementado
- Aba **Documentos / NFS-e**: cinco indicadores, listagem de dez colunas, pesquisa, filtro por período de emissão e exportação CSV.
- Exemplos marcados como fictícios no GitHub Pages; não são dados reais da empresa.
- Proxy protegido `GET /api/documentos-eletronicos?from=2026-10-01&to=2026-10-20` no Node.js, que converte datas para `dd/mm/aaaa` e consulta o DSS com segredo guardado no servidor.
- Sem `from` e `to`, o proxy pode solicitar todos os registros; com apenas uma data, responde HTTP 400 por precaução.
- O proxy exige sessão autorizada ou token Bearer privado configurado no servidor e permissão Financeiro. Nenhum segredo é enviado ao JavaScript público.
- A resposta descarta campos que não fazem parte do esquema documentado. Erros de credencial, módulo desabilitado e resposta DSS inválida são tratados.

## Como criar no Render
1. Entre em [Render Dashboard](https://dashboard.render.com/) > **New > Blueprint**, conecte o GitHub e selecione `joaopedrocostalog-netizen/Faturamento`. O `render.yaml` já define um serviço Node.js chamado `costalog-faturamento-api`. Alternativamente, **New > Web Service**, branch `main`, Build Command `npm install --omit=dev`, Start Command `npm start`, Health Check `/api/health`.
2. Configure **Environment** com os valores privados abaixo. **Não envie senhas para o chat ou repositório**:
   - `DSS_BASE_URL`: URL base HTTPS do Swagger, por exemplo `https://costalog.dssinformatica.com.br/wsdss` **somente se confirmada pelo fornecedor**.
   - `DSS_DOCUMENTOS_PATH`: caminho real da operação GET, por exemplo `/rota-do-swagger` (apenas exemplo, **não usar literalmente**).
   - `DSS_AUTH_TYPE=basic` se o DSS usa Basic Auth.
   - `DSS_USERNAME`: usuário DSS autorizado.
   - `DSS_PASSWORD`: senha DSS (marcar como Secret).
   - `DSS_NFSE_SYNC_TOKEN definido no servidor privado`
   - `DSS_NFSE_SYNC_TOKEN`: token **longo, aleatório e privado**, diferente da senha DSS.
   - `PORTAL_ALLOWED_ORIGINS`: manter vazio até haver frontend com autenticação corporativa.
3. Faça o deploy. Abra `https://SEU-SERVICO.onrender.com/api/health`. `status: "ok"` indica servidor no ar, **não comprova acesso ao DSS**.
4. Faça uma consulta privada num cliente HTTP (Postman/Insomnia) configurando `Authorization: Bearer SEU_TOKEN_PRIVADO` e solicitando `GET https://SEU-SERVICO.onrender.com/api/documentos-eletronicos?from=2026-10-01&to=2026-10-20`.
5. Se HTTP 403 mencionar `tms_faturamento`, peça habilitação desse módulo ao fornecedor DSS. HTTP 404 pede conferir o caminho. HTTP 401 na resposta do proxy significa ausência/erro de token; erro de autenticação *no DSS* é repassado como HTTP 502 para não confundir os dois níveis.
6. Após confirmar um teste real e decidir a forma de restringir o site financeiro, integre a visualização real pelo backend. O portal atual **não envia dados financeiros reais para visitantes**.

### Por que o GitHub Pages não busca NFS-e reais diretamente?
O site foi configurado anteriormente para abrir sem senha e está público na internet. Guardar o token no JavaScript permitiria qualquer pessoa consultar os documentos fiscais; esconder o token por CORS não resolveria. O proxy do Render **exige** um Bearer válido, portanto o site público segue mostrando exemplos. Para não pedir senha em tela, use acesso corporativo transparente (por exemplo, VPN/intranet ou um gateway SSO) e só depois habilite dados reais.

### Banco de dados
A nova rota não exige MariaDB: consulta o DSS sob demanda e devolve os documentos autorizados. É possível persistir um histórico futuramente, mas não é necessário para o primeiro teste.

### Checklist
- [ ] Confirmar URL base e **rota GET exata** no Swagger
- [ ] Confirmar autenticação Basic Auth ou Header com o fornecedor
- [ ] Confirmar módulo `tms_faturamento` habilitado
- [ ] Criar serviço no Render e preencher segredos privados
- [ ] Testar `/api/health` e depois uma consulta autenticada
- [ ] Definir acesso seguro antes de disponibilizar dados reais no frontend

### Token de sincronização com privilégios mínimos
O botão do site utiliza `DSS_NFSE_SYNC_TOKEN` (segredo separado de `PORTAL_ACCESS_TOKEN`). Esse Bearer concede acesso **somente** ao endpoint de documentos eletrônicos, após validação no Node.js. Cadastre uma sequência aleatória de no mínimo 32 caracteres na aba **Environment** do Render; informe no formulário somente quando for sincronizar.
