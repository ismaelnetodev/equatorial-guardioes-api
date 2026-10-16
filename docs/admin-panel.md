# Painel de administração

O painel está integrado ao aplicativo Expo, na rota `/admin`, e também pode
ser aberto pelo link “Acesso administrativo” na tela de login.

Na raiz, execute a API e o aplicativo web em terminais separados:

```sh
npm run dev:api
npm run dev:web
```

Abra `/admin` na URL exibida pelo Expo (normalmente
`http://localhost:8081/admin`). O endereço da API é o mesmo configurado em
`apps/mobile/.env`, pela variável `EXPO_PUBLIC_API_URL`, incluindo `/api/v1`.
O painel também funciona no aplicativo nativo. Nenhum novo serviço de hosting
ou workspace é necessário.

## Funcionalidades

- Login administrativo e saída; validação de `ADMIN` pela API.
- Trilhas: cadastro, edição de título e descrição, publicação, arquivamento,
  desativação e ordenação.
- Módulos: cadastro, edição do conteúdo, duração, quiz obrigatório, estado de
  publicação e ordenação dentro da trilha.
- Pontos, recompensas e limites: alteração de valores, ativação/desativação e
  motivo opcional registrado na auditoria existente.
- Histórico: filtros por categoria e chave, valores anteriores/novos, autor,
  data e paginação.
- Minha conta: troca da própria senha com confirmação da senha atual.

Os contratos são importados do OpenAPI gerado em `src/services/api.types.ts`.
O painel não acessa Prisma ou segredos do backend. Erros de permissão e sessão
retornam ao formulário de entrada; as operações de administração permanecem
protegidas no servidor, inclusive chamadas feitas fora do painel.

## Conta administrativa

A conta de teste solicitada é provisionada diretamente no PostgreSQL por uma
operação explícita. Ela não é recriada ao iniciar a API, fazer build ou aplicar
migrations. Nenhuma senha temporária fica embutida no frontend, nas migrations
ou no código do provisionamento.

O comando `npm run admin:user` recebe um JSON com `email` e `password` pelo
stdin. Ele cria uma conta `ADMIN` ou atualiza **a senha e o papel** da conta
com aquele e-mail, preservando os outros dados. Exemplo em PowerShell 7:

```powershell
$adminCredentials = @{ email = 'admin@exemplo.com'; password = Read-Host 'Senha temporária' -MaskInput }
$adminCredentials | ConvertTo-Json -Compress | npm run admin:user
Remove-Variable adminCredentials
```

O comando usa `apps/api/.env` e o mesmo hash scrypt do login. Por se tratar de
uma conta interna, o cadastro inicial usa nome “Administrador” e bairro “Não
informado”, conforme os campos obrigatórios do model existente.

Para alterar a senha pelo painel: **Minha conta → Alterar minha senha**.
`PATCH /api/v1/admin/password` aceita `currentPassword` (1 a 128 caracteres)
e `newPassword` (8 a 128), exige Bearer token e `ADMIN`, verifica a senha atual
e altera somente a conta autenticada. Tentativas são limitadas a cinco por
15 minutos por IP. A atualização usa comparação do hash anterior para detectar
trocas concorrentes.

O login aceita senhas existentes de 1 a 128 caracteres para permitir contas
temporárias. O cadastro público e a troca de senha continuam exigindo oito
caracteres. As sessões seguem a duração existente de 24 horas; a troca da senha
não revoga tokens já emitidos, pois o mecanismo atual não possui revogação de
sessões. Na versão web o token fica apenas em memória: recarregar a página
exige entrar novamente. No aplicativo nativo usa o armazenamento seguro
existente.

## Limitações existentes

O painel não cria questões de quiz: o backend ainda não oferece esse cadastro
nem a execução do quiz. Marcar um módulo como obrigatório depende dessa futura
integração para permitir sua conclusão pelo usuário. As configurações de
recompensas também continuam dependendo da futura execução de concessões e
resgates, conforme o [guia do módulo](points-rewards-administration.md).

Não há exclusão de trilhas ou módulos, edição de saldos, criação de novas
categorias de regras ou gestão de usuários no painel. Os estados de publicação
e as restrições existentes no backend são respeitados.
