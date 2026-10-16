# Guardiões

Monorepo da plataforma Guardiões, com uma API para autenticação, administração de conteúdo e progresso em trilhas de capacitação, e um aplicativo React Native para acessar a plataforma.

## Tecnologias

- **API:** Node.js, TypeScript, Fastify, TypeBox, Prisma e PostgreSQL.
- **Aplicativo:** React Native, Expo, Expo Router e TypeScript.
- **Integração:** HTTP com contratos TypeScript gerados do OpenAPI.
- **Organização:** npm workspaces, com um único package-lock.json na raiz.

## Estrutura

```text
apps/
  api/
    src/                Rotas, controllers, schemas, serviços e testes
    prisma/             Schema e migrations do PostgreSQL
    .env.example        Variáveis de ambiente da API
    package.json
  mobile/
    src/
      app/              Telas e navegação com Expo Router
      components/       Componentes da interface
      features/         Integrações organizadas por funcionalidade
      services/         Cliente HTTP, sessão e contratos da API
    assets/
    .env.example        Endereço público da API
    app.json
    package.json
docs/                   Guias do projeto
scripts/                Ferramentas do monorepo
package.json            Workspaces e comandos compartilhados
package-lock.json       Dependências dos workspaces
```

A API e o aplicativo possuem configurações e dependências próprias. O aplicativo acessa o banco exclusivamente pela API.

## Pré-requisitos

- Node.js 24 LTS e npm.
- PostgreSQL local ou hospedado, como o Neon.
- Para testar no celular, um dispositivo com Expo Go compatível ou um development build. Também é possível usar um emulador Android ou a prévia web.

## Instalação

Execute os comandos a partir da raiz do repositório:

```sh
npm ci
```

Em um novo clone, crie os arquivos de configuração a partir dos exemplos. No PowerShell:

```powershell
Copy-Item apps/api/.env.example apps/api/.env
Copy-Item apps/mobile/.env.example apps/mobile/.env
```

Se esses arquivos já estiverem configurados, mantenha seus valores.

### Ambiente da API

Configure `apps/api/.env`:

| Variável | Uso |
| --- | --- |
| `NODE_ENV` | Ambiente de execução. |
| `HOST` | Interface de rede. `0.0.0.0` permite acesso pela rede local. |
| `PORT` | Porta da API. Padrão: `3000`. |
| `CORS_ORIGINS` | Origens web permitidas, separadas por vírgula. A prévia Expo usa `http://localhost:8081`. |
| `DATABASE_URL` | Conexão PostgreSQL usada pelo Prisma e pela API. |
| `AUTH_TOKEN_SECRET` | Segredo longo e aleatório para assinar os tokens. |

Credenciais do Neon e segredos de autenticação ficam apenas na API. Os arquivos `.env` não são versionados.

### Ambiente do aplicativo

Configure `apps/mobile/.env`:

```dotenv
EXPO_PUBLIC_API_URL=http://localhost:3000/api/v1
```

Use o endereço adequado ao ambiente:

| Ambiente | Exemplo de URL |
| --- | --- |
| Navegador no computador | `http://localhost:3000/api/v1` |
| Emulador padrão do Android Studio | `http://10.0.2.2:3000/api/v1` |
| Celular físico na mesma rede | `http://IP_DO_COMPUTADOR:3000/api/v1` |
| Aplicativo distribuído | Endereço HTTPS da API hospedada. |

No celular, localhost aponta para o próprio dispositivo. O computador precisa permitir conexões na porta da API. Para acessar a prévia web por outro endereço, inclua a origem correspondente em CORS_ORIGINS. Reinicie o Expo após alterar as variáveis.

Variáveis EXPO_PUBLIC_* são públicas e não devem conter credenciais do banco ou segredos.

### Preparar a API

```sh
npm run db:generate
npm run api:types
npm run db:deploy
```

A aplicação das migrations exige uma conexão PostgreSQL válida. As migrations existentes ficam em `apps/api/prisma/migrations`.

## Desenvolvimento

Em um terminal, inicie a API:

```sh
npm run dev:api
```

Em outro, inicie o aplicativo:

```sh
npm run dev:mobile
```

Para abrir a prévia web:

```sh
npm run dev:web
```

A tela inicial consulta o catálogo público de trilhas. Os fluxos de cadastro, login e navegação pelo conteúdo poderão ser desenvolvidos sobre a estrutura existente. O cliente HTTP centraliza o envio do Bearer token; o serviço de sessão oferece armazenamento seguro no Android e iOS. Na prévia web, o token é mantido apenas em memória.

## Documentação e contratos

Com a API em execução, consulte o [Swagger UI](http://localhost:3000/documentation). As rotas usam o prefixo `/api/v1`.

As operações administrativas e as regras de publicação estão no [guia de administração de conteúdo](docs/content-administration.md).

Após alterar os contratos da API, regenere os tipos usados pelo aplicativo:

```sh
npm run api:types
```

O arquivo `apps/mobile/src/services/api.types.ts` é gerado automaticamente. Não o edite manualmente nem importe models do Prisma no aplicativo.

## Banco de dados

| Comando na raiz | Uso |
| --- | --- |
| `npm run db:generate` | Gera o cliente Prisma. |
| `npm run db:migrate -- --name nome_da_alteracao` | Cria e aplica uma migration em desenvolvimento. |
| `npm run db:deploy` | Aplica as migrations existentes. |
| `npm run db:studio` | Abre o Prisma Studio. |

## Verificação e build

```sh
npm run typecheck
npm test
npm run build
```

| Comando | Uso |
| --- | --- |
| `npm run test:watch` | Acompanha os testes da API. |
| `npm run check:mobile` | Verifica a compatibilidade das dependências Expo. |
| `npm run build:api` | Compila a API em `apps/api/dist`. |
| `npm run build:mobile` | Exporta os bundles Android, iOS e web em `apps/mobile/dist`. |
| `npm run start:api` | Executa a API compilada. |

Os testes da API usam persistência simulada. A exportação do mobile valida os bundles JavaScript; a geração de aplicativos nativos instaláveis é uma etapa separada, com builds locais ou EAS Build. No Windows, a compilação nativa local de iOS requer um Mac.

Os deploys da API e do aplicativo são independentes, mesmo compartilhando o repositório.
