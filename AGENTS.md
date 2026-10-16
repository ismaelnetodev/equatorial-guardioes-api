# AGENTS.md

## Estrutura

Este repositório é um monorepo com npm workspaces:

- apps/api: backend Node.js, TypeScript, Fastify, TypeBox, Prisma e PostgreSQL. Consulte também apps/api/AGENTS.md.
- apps/mobile: aplicativo React Native com Expo, Expo Router e TypeScript.
- docs: documentação compartilhada.

Cada aplicação mantém suas dependências, configurações e variáveis de ambiente no próprio diretório. Utilize apenas o package-lock.json da raiz e execute npm ci na raiz.

## Desenvolvimento

- Preserve a arquitetura modular existente da API e o prefixo /api/v1.
- O aplicativo acessa os dados por HTTP; não importe Prisma, serviços internos ou segredos do backend no mobile.
- Organize o mobile em src/app (rotas), src/components, src/features e src/services.
- Reutilize contratos gerados do OpenAPI para integrar o aplicativo à API.
- Não crie pacotes compartilhados ou novas ferramentas sem necessidade.
- Use TypeScript em modo strict e evite any.
- Atualize o README quando alterar comandos ou configuração.
- Não versione arquivos .env, credenciais, node_modules, dist ou caches do Expo.

## Verificações

Execute na raiz antes de concluir alterações:

- npm run typecheck
- npm test
- npm run build

Para alterações de contratos, execute npm run api:types. Para alterações no banco, use as migrations em apps/api/prisma/migrations.
