# Deployment

A aplicação possui três serviços: web Expo, API Node.js e IA Python.
O web está no Cloudflare Pages (`guardioesenergia`); API e IA estão no Azure
Container Apps, grupo `guardioes-mvp`. As imagens ficam no ACR `guardioesapi`.

## Integração

- API: `DATABASE_URL` e `AUTH_TOKEN_SECRET`.
- Migrations: `DIRECT_DATABASE_URL`, quando configurada.
- IA: `GEMINI_API_KEY` e `API_BASE_URL` apontando para a API com `/api/v1`.
- App: `EXPO_PUBLIC_API_URL` e `EXPO_PUBLIC_IA_URL` com os endereços HTTPS publicados.
- API e IA: `CORS_ORIGINS` com a origem do web.
- Pontos (treino): `POINTS_DAILY_LIMITS_ENABLED` (padrão `true`; `false`/`0` desativa limites diários em demo). `POINTS_QUEUE_INTERVAL_MS` (padrão `3600000`; `0` desliga o poll in-process). Não há docker-compose nem CronJob separado: a fila (`LearningAward` com `grantedAt` null) é consumida in-process no processo da API, em `POST /api/v1/progress/learning-awards/claim`, e no script `npm run db:release:pending-points -w guardioes-api`.

Credenciais e configurações específicas do ambiente ficam no gerenciador de
secrets da hospedagem, fora do repositório. Variáveis `EXPO_PUBLIC_*` são públicas.

## Entrega

O workflow `.github/workflows/delivery.yml` executa somente CI: valida migrations
em PostgreSQL temporário, contratos, tipos, testes e builds. O deploy automático
não está configurado; a publicação pelos CLIs é uma etapa separada.

Antes de publicar, aplique as migrations com `npm run db:deploy`, configure a
persistência ou reconstrução do índice RAG da IA e teste login e chat autenticado.
Use `npm run build:web` para exportar o web. O perfil Android `preview` em
`apps/mobile/eas.json` gera APK após vincular o projeto à conta Expo.

## Publicar o web de produção (PowerShell, na raiz)

```powershell
$env:EXPO_PUBLIC_API_URL = 'https://guardioes-api.purplebush-6b46e5a7.brazilsouth.azurecontainerapps.io/api/v1'
$env:EXPO_PUBLIC_IA_URL = 'https://guardioes-ia.purplebush-6b46e5a7.brazilsouth.azurecontainerapps.io'
npm run build:web:production
if ($LASTEXITCODE -ne 0) { throw 'Build interrompido' }
npx wrangler pages deploy apps/mobile/dist --project-name guardioesenergia --branch main
```

Esse comando ignora `.env` local e exige as duas URLs HTTPS. Variáveis Expo são
incorporadas ao JavaScript: alterar uma variável depois do build não corrige o
bundle. Confira as URLs no JavaScript servido pelo domínio de produção.

## Publicar a IA

Depois do workflow **Build container images** concluir, importe a tag do commit
do GHCR para o ACR e atualize somente `guardioes-ia`:

```powershell
$imageCommit = git rev-parse HEAD
az acr import --name guardioesapi --source "ghcr.io/ismaelnetodev/equatorial-guardioes-api/ia:$imageCommit" --image "guardioes-ia:$imageCommit"
if ($LASTEXITCODE -ne 0) { throw 'Importação interrompida' }
az containerapp update -g guardioes-mvp -n guardioes-ia --image "guardioesapi.azurecr.io/guardioes-ia:$imageCommit"
```

Preserve as variáveis e referências de secrets existentes. Confira a revisão pronta,
`/health`, CORS e prepare o índice conforme [o guia do chatbot](chatbot-ia.md#base-de-ajuda-e-índice).
Teste as três perguntas sugeridas em `/chat-duvidas` antes de considerar o deploy
concluído. Sem volume, o índice é reconstruído automaticamente após a substituição
do container; a preparação antecipada evita esse trabalho na primeira pergunta.
