# Guardiões da Energia

Monorepo da plataforma Guardiões da Energia, com uma API para autenticação, administração de conteúdo e progresso em trilhas de capacitação, e um aplicativo React Native para acessar a plataforma.

## Tecnologias

- **API:** Node.js, TypeScript, Fastify, TypeBox, Prisma e PostgreSQL.
- **Aplicativo:** React Native 0.86.3, React 19.2.3, Expo SDK 57, Expo Router e TypeScript.
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
| `CORS_ORIGINS` | Origens web permitidas, separadas por vírgula, sem caminhos. Obrigatória em produção, com origens HTTPS explícitas. |
| `CORS_ALLOW_LOCAL_NETWORK` | Em `NODE_ENV=development` (ou ausente), permite localhost, loopback e IPv4 privados em qualquer porta. Padrão: habilitado. Use `false` para exigir somente a lista explícita. Não habilita rede local em produção ou outros ambientes. |
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

No celular, localhost aponta para o próprio dispositivo. Use o IP atual do computador (`ipconfig` no Windows), mantenha `HOST=0.0.0.0` e permita conexões na porta da API no firewall da rede privada. Reinicie o Expo após alterar as variáveis.

### CORS local e produção

Em desenvolvimento, são aceitas origens HTTP/HTTPS em `localhost`, `127.0.0.0/8`, `[::1]` e nas redes privadas `10.0.0.0/8`, `172.16.0.0/12` e `192.168.0.0/16`. Isso permite abrir o Expo web pelo IP sem atualizar a lista a cada troca de rede. Domínios externos precisam constar em `CORS_ORIGINS`. Para restringir também o ambiente local, configure `CORS_ALLOW_LOCAL_NETWORK=false` e liste cada origem exata (incluindo a porta).

Em produção, configure por exemplo:

```dotenv
NODE_ENV=production
HOST=0.0.0.0
CORS_ORIGINS=https://app.seudominio.com,https://admin.seudominio.com
```

A API recusa iniciar em produção se a lista estiver vazia ou contiver origens inválidas, curingas ou HTTP. Informe a origem do **frontend**, não o endereço da API; não inclua `/api/v1` na lista. Subdomínios e portas não são liberados implicitamente. Publique a API em HTTPS e configure `EXPO_PUBLIC_API_URL` com sua URL HTTPS para evitar bloqueio de conteúdo misto.

O preflight permite os métodos da API e os headers `Content-Type`, `Authorization` e `Accept`. A autenticação usa Bearer token, sem cookies cross-origin. Requisições sem `Origin` continuam funcionando para aplicativos nativos e clientes de servidor. CORS controla a leitura pelo navegador; a autenticação e a autorização continuam sendo exigidas pelas rotas protegidas. Referência: [documentação do @fastify/cors](https://github.com/fastify/fastify-cors#options).

Se o navegador mostrar status `(null)`, verifique também a conectividade: abra `http://IP_DO_COMPUTADOR:3000/documentation/json` no dispositivo. IP incorreto, API parada, firewall e página HTTPS chamando API HTTP podem impedir qualquer resposta, mesmo com o CORS correto.

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

Para testar no celular, use o Expo Go compatível com **SDK 57** (por exemplo, cliente 57.0.9). Mantenha o computador e o celular na mesma rede, configure `EXPO_PUBLIC_API_URL` com o IP atual do computador e escaneie o QR code do Expo. Após trocar a versão do SDK, encerre o Metro anterior e limpe seu cache:

```sh
npm run dev:mobile -- --clear --go
```

Valide as versões com `npm run check:mobile`. Ao trocar o SDK, alinhe também React, React Native e módulos Expo às versões indicadas pelo Expo; a versão do aplicativo em `app.json` não define a compatibilidade com Expo Go.

Reanimated e Worklets estão fixados nas versões nativas do SDK 57 no mobile e nos `overrides` da raiz, pois também entram como dependências transitivas do Router. Atualize esses valores em conjunto ao migrar o SDK para evitar duplicações incompatíveis com o Expo Go.

Para abrir a prévia web:

```sh
npm run dev:web
```

A abertura do app (`/`) redireciona sempre para `/entrar`. A tela `/inicio` consulta o catálogo público de trilhas. O login envia e-mail ou celular e senha para `POST /api/v1/entrar`, armazena o token e abre o catálogo em `/inicio`. O cliente HTTP centraliza o envio do Bearer token; o serviço de sessão oferece armazenamento seguro no Android e iOS. Na prévia web, o token é mantido apenas em memória.

Para testar, inicie a API e o Expo, abra `/entrar` na prévia web ou toque em “Entrar na minha conta”. Crie previamente um usuário pelo endpoint `POST /api/v1/cadastrar` no Swagger. Use o mesmo celular cadastrado (incluindo código do país, se informado); o formulário remove espaços, parênteses e hífens, sem acrescentar prefixos. O login exibe erros de validação, credenciais, limite de tentativas e conexão. Recuperação de senha e Google exibem avisos de indisponibilidade até que seus fluxos sejam implementados. O botão de emergência abre `tel:116` em dispositivos compatíveis.

## Documentação e contratos

Com a API em execução, consulte o [Swagger UI](http://localhost:3000/documentation). As rotas usam o prefixo `/api/v1`.

As operações administrativas e as regras de publicação estão no [guia de administração de conteúdo](docs/content-administration.md).

A administração de pontos, recompensas, limites e auditoria está no [guia de pontos e recompensas](docs/points-rewards-administration.md). As rotas `/api/v1/admin/points-rewards` exigem Bearer token e papel `ADMIN`. A configuração inicial é instalada pela migration `20261016210000_program_configuration`, com `npm run db:deploy`; atualizações posteriores ficam no banco. O learner executa o livro de pontos, ranking, resgate e convites em `/api/v1/ranking`, `/recompensas`, `/convidar` e `/perfil` (migration `20261017120000_community_points`).

Após alterar os contratos da API, regenere os tipos usados pelo aplicativo:

```sh
npm run api:types
```

O arquivo `apps/mobile/src/services/api.types.ts` é gerado automaticamente. Não o edite manualmente nem importe models do Prisma no aplicativo.

## Banco de dados

O cadastro está em `/cadastrar`, acessível por “Criar conta” em `/entrar`. Após cadastrar, o app tenta autenticar e abre `/introducao`, com três etapas, sem o aviso de instalação na tela inicial. “Pular” e “Começar” abrem `/inicio` com sessão ou `/entrar` se a autenticação não foi concluída. O seletor consulta `GET /api/v1/neighborhoods/?municipalityCode=2111300`, busca por nome sem diferenciar acentos e permite informar “Outro bairro”. Nomes livres ficam no usuário, sem contaminar o catálogo de origem oficial. O cadastro envia `neighborhoodId` quando a escolha vem do catálogo; a API valida o município e utiliza o nome armazenado no banco.

As migrations incluem a tabela `Neighborhood`, o vínculo opcional ao usuário e os dados do catálogo. `npm run db:deploy` recria tudo em um banco novo, sem depender de downloads nem de seed manual:

- `20261016200000_neighborhood_catalog`: 173 bairros do ZIP `MA_bairros_CD2022.zip` do IBGE, preservando códigos e municípios. O arquivo **não contém São Luís (2111300)**; São José de Ribamar não é tratado como São Luís.
- `20261016201000_saoluis_neighborhoods`: 287 nomes únicos da [relação municipal publicada pela Prefeitura em 28/04/2022](https://www.saoluis.ma.gov.br/portal/noticias/0/3/2172/ludovicenses-com-16-anos-ou-mais-poderao-votar-para-eleger-conselho-municipal-do-orcamento-participativo). A [Prefeitura explica a ausência no IBGE](https://www.saoluis.ma.gov.br/sao-luis-em-dados---2010-e-2022/). Os IDs `slz-…` são internos, não códigos IBGE. Nomes repetidos entre microrregiões foram unificados; a grafia da fonte foi preservada. A lista é uma referência administrativa de 2022 e pode não refletir subdivisões atuais.

Os SQLs versionados registram fonte e SHA256. Os scripts abaixo permitem conferir a extração a partir dos arquivos originais, sem executar SQL no banco. Gere arquivos temporários para revisão; para atualizar dados já aplicados, crie uma **nova** migration:

```sh
node scripts/import-ibge-neighborhoods.mjs caminho/MA_bairros_CD2022.zip ibge-review.sql
node scripts/import-saoluis-neighborhoods.mjs caminho/pagina-prefeitura.html saoluis-review.sql
```

O primeiro SQL contém somente os INSERTs; a migration inclui também a criação da tabela. O segundo extrai as 50 microrregionais da página municipal e preserva “Sol e Mar” como nome próprio.

| Comando na raiz | Uso |
| --- | --- |
| `npm run db:generate` | Gera o cliente Prisma. |
| `npm run db:migrate -- --name nome_da_alteracao` | Cria e aplica uma migration em desenvolvimento. |
| `npm run db:deploy` | Aplica as migrations existentes. |
| `npm run db:studio` | Abre o Prisma Studio. |

## Verificação e build

Os SVGs da marca ficam em `apps/mobile/assets`. Após atualizá-los, execute `node scripts/generate-mobile-assets.mjs` na raiz para gerar os PNGs da logo, ícone do app, ícone adaptativo Android e favicon. A conversão usa Sharp como dependência de desenvolvimento. Para visualizar alterações no ícone instalado, gere um novo build nativo; o Expo Go mantém seu próprio ícone.

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
