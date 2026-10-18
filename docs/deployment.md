# Deployment

A aplicação possui três serviços: web Expo, API Node.js e IA Python.
O banco pode ser hospedado no Neon. A hospedagem da API e da IA está em definição.

## Integração

- API: `DATABASE_URL` e `AUTH_TOKEN_SECRET`.
- Migrations: `DIRECT_DATABASE_URL`, quando configurada.
- IA: `GEMINI_API_KEY` e `API_BASE_URL` apontando para a API com `/api/v1`.
- App: `EXPO_PUBLIC_API_URL` e `EXPO_PUBLIC_IA_URL` com os endereços HTTPS publicados.
- API e IA: `CORS_ORIGINS` com a origem do web.

Credenciais e configurações específicas do ambiente ficam no gerenciador de
secrets da hospedagem, fora do repositório. Variáveis `EXPO_PUBLIC_*` são públicas.

## Entrega

O workflow `.github/workflows/delivery.yml` executa somente CI: valida migrations
em PostgreSQL temporário, contratos, tipos, testes e builds. O deploy automático
será configurado após a escolha da hospedagem.

Antes de publicar, aplique as migrations com `npm run db:deploy`, configure a
persistência ou reconstrução do índice RAG da IA e teste login e chat autenticado.
Use `npm run build:web` para exportar o web. O perfil Android `preview` em
`apps/mobile/eas.json` gera APK após vincular o projeto à conta Expo.
