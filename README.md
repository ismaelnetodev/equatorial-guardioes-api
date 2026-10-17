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

A abertura do app (`/`) consulta a sessão salva: sem token, abre `/entrar`; com token, abre `/trilha`, que valida a sessão em `GET /api/v1/me`. Sessões expiradas ou de contas excluídas retornam ao login. `/inicio` permanece como redirecionamento para `/trilha`. O login envia e-mail ou celular e senha para `POST /api/v1/entrar`, armazena o token e abre `/trilha`. O cliente HTTP centraliza o envio do Bearer token; o serviço de sessão oferece armazenamento seguro no Android e iOS. Na prévia web, o token é mantido apenas em memória.

Para testar, inicie a API e o Expo, abra o app ou `/entrar` na prévia web e crie uma conta pelo botão “Criar conta”. Também é possível cadastrar pelo endpoint `POST /api/v1/cadastrar` no Swagger. Use o mesmo celular cadastrado (incluindo código do país, se informado); o formulário remove espaços, parênteses e hífens, sem acrescentar prefixos. O login exibe erros de validação, credenciais, limite de tentativas e conexão. Recuperação de senha e Google exibem avisos de indisponibilidade até que seus fluxos sejam implementados. O botão de emergência abre `tel:116` em dispositivos compatíveis.

## Documentação e contratos

Com a API em execução, consulte o [Swagger UI](http://localhost:3000/documentation). As rotas usam o prefixo `/api/v1`.

As operações administrativas e as regras de publicação estão no [guia de administração de conteúdo](docs/content-administration.md).

A administração de pontos, recompensas, limites e auditoria está no [guia de pontos e recompensas](docs/points-rewards-administration.md). As rotas `/api/v1/admin/points-rewards` exigem Bearer token e papel `ADMIN`. A configuração inicial é instalada pela migration `20261016210000_program_configuration`, com `npm run db:deploy`; atualizações posteriores ficam no banco.

O [painel administrativo](docs/admin-panel.md) está disponível em `/admin` no aplicativo web (`npm run dev:web`) e pelo link “Acesso administrativo” no login. Inclui trilhas, módulos, pontuação, recompensas, limites, histórico e troca da própria senha. O comando `npm run admin:user` provisiona uma conta `ADMIN` a partir de credenciais recebidas por stdin, sem senha padrão no código.

Após alterar os contratos da API, regenere os tipos usados pelo aplicativo:

```sh
npm run api:types
```

O arquivo `apps/mobile/src/services/api.types.ts` é gerado automaticamente. Não o edite manualmente nem importe models do Prisma no aplicativo.

## Banco de dados

Para popular a tela de trilhas com conteúdo de demonstração, execute `npm run db:seed:demo` na raiz, usando o PostgreSQL configurado em `apps/api/.env`. O comando cria a trilha **Segurança no seu bairro**, com sete módulos ativos e publicados, treinamento em três etapas com cartões e três perguntas por módulo, usadas no pré-teste e no pós-teste. O fluxo é pré-teste → treinamento → pós-teste → conclusão, respeitando as regras de aprovação e pontuação configuradas. A carga é transacional e usa IDs fixos: novas execuções não duplicam a trilha nem sobrescrevem edições feitas no painel. Na demonstração antiga, complementa somente os módulos de IDs conhecidos que ainda não tenham perguntas nem etapas, ativando o quiz. Módulos com conteúdo estruturado são preservados. Progressos e conclusões existentes são mantidos; para testar desde o início, use uma conta nova. O conteúdo é demonstrativo para testar o aplicativo. Ela não cria progresso de usuários ou concede pontos. Após executar, atualize a tela `/trilha`; contas comuns começam com o primeiro módulo disponível e os seguintes bloqueados pela sequência existente. A conta `ADMIN` tem acesso de consulta a todos os módulos, conforme a regra já existente na API.

O cadastro está em `/cadastrar`, acessível por “Criar conta” em `/entrar`. Após cadastrar, o app tenta autenticar e abre `/introducao`, com três etapas, sem o aviso de instalação na tela inicial. “Pular” e “Começar” abrem `/trilha` com sessão ou `/entrar` se a autenticação não foi concluída. O seletor consulta `GET /api/v1/neighborhoods/?municipalityCode=2111300`, busca por nome sem diferenciar acentos e permite informar “Outro bairro”. Nomes livres ficam no usuário, sem contaminar o catálogo de origem oficial. O cadastro envia `neighborhoodId` quando a escolha vem do catálogo; a API valida o município e utiliza o nome armazenado no banco.

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

### Tela de trilha

A rota `/trilha` carrega `GET /api/v1/trails/` e os detalhes autenticados em `GET /api/v1/trails/{trailId}` usando os contratos OpenAPI gerados. Exibe nome e iniciais da conta, seletor quando há várias trilhas, módulos ordenados e estados de bloqueio, andamento e conclusão retornados pela API. A numeração visual começa em 0; a ordem original do backend é preservada. Há carregamento, estado vazio, erro com nova tentativa e atualização ao puxar.

Toque em um módulo para abrir `/modulo/{moduleId}?trailId={trailId}`. O detalhe consulta a trilha e `GET /api/v1/progress/trails/{trailId}` para exibir o estado e a exigência de quiz. Iniciar treinamento envia `POST /api/v1/progress/modules/{moduleId}/start`; concluir envia `POST /api/v1/progress/modules/{moduleId}/complete`. Ao retornar à trilha, o progresso é consultado novamente e os próximos módulos refletem o desbloqueio feito pelo backend. O menu Perfil mostra a conta atual e permite sair. Ajuda e Reportar oferecem a ligação de emergência para 116.

O detalhe apresenta resumo, objetivos extraídos das listas do conteúdo (ou a descrição), etapas e leitura. Módulos com quiz consultam `GET /api/v1/modules/{moduleId}/learn` após iniciar o módulo. A rota `/modulo/aprender` conecta pré-teste, treinamento estruturado, feedback por resposta do pós-teste e resultados aos endpoints de aprendizado. Ao aprovar, o usuário conclui o módulo pela API de progresso. Módulos sem quiz preservam a leitura e conclusão direta. As respostas, notas, bloqueios, pontos recebidos e pontos pendentes vêm do backend. Não há percentual de treinamento simulado.

O card Continuar mostra o módulo atual e a quantidade real de módulos concluídos. O aviso de Reportar bloqueado oferece “Fazer módulo 0”, “Agora não” e ligação 116. Saldo global, patentes e ranking continuam sem integração. A API de relatos já existe; a interface de envio será uma entrega separada. Consulte [pendências de integração das telas da trilha](docs/trail-integration.md) para os dados faltantes e critérios de implementação. As artes dos nós foram extraídas dos SVGs fornecidos; os ícones podem ser regenerados com `node scripts/generate-trail-icons.mjs` e o fundo do detalhe com `node scripts/generate-module-pattern.mjs`.

### Pontuação de relatos v2

Aplique a migration com `npm run db:deploy` antes de iniciar a API atualizada.
O envio não concede pontos. Para validar e resolver, o administrador envia
`{ "status": "RESOLVED", "confirmedRisk": "LOW" | "MEDIUM" | "HIGH" }`
em `PATCH /api/v1/admin/relatos/:reportId/status`. A classificação é da equipe,
independente da urgência informada pelo usuário. A resolução é a validação final
neste fluxo; relatos duplicados ou não confirmados devem usar `NOT_CONFIRMED`.
Regras inativas concedem zero. Limites inativos não são aplicados; configurações
ausentes ou limites ativos sem valor impedem a validação até serem configurados.
Os limites contam relatos com pontos pela data da validação, em America/Fortaleza;
ao atingir o limite o relato é resolvido com zero, sem concessão posterior automática.
Conflitos concorrentes retornam 409 e exigem nova tentativa.

A migration preserva os pontos antigos em `ReportLegacyPointsAudit` e zera
as concessões legadas, inclusive de relatos resolvidos: não há risco confirmado
pela equipe nos dados antigos para recalculá-las. O snapshot permite revisão
operacional auditável; não há reatribuição retroativa automática.

### Aprendizado e pontos v2

Aplique `npm run db:deploy` antes de iniciar a API. A migration
`20261017020000_learning_rules` preserva concessões antigas em
`LearningLegacyPointsAudit` e zera os pontos legados de quizzes/treinamento.
Notas, aprovações e progresso históricos são preservados; não há reatribuição
retroativa de pontos sem comprovação dos critérios v2.

- Pré-teste: diagnóstico sem pontos, registrado uma única vez por módulo.
- Treinamento: concluir a etapa não pontua. A conclusão do módulo em
  `POST /api/v1/progress/modules/:moduleId/complete` usa `module_completion`
  (inicialmente 2 pontos), com `module_minimum_time` (70% da duração prevista,
  medido pelo tempo desde o início no servidor). Duração ausente impede conclusão
  enquanto esse requisito estiver ativo. Esse controle não mede atenção ou presença ativa.
- Quiz do módulo: aprovação consulta `quiz_pass_score` (80%), sem usar o campo
  legado `quizMinimumScore`. Regra `module_quiz` começa em zero. Cada tentativa
  finalizada preserva seu corte e resultado; mudanças valem para novas avaliações e para liberar módulos ainda não concluídos. Novas tentativas preservam seu corte; tentativas legadas sem corte registrado exibem o requisito atual, mantendo nota e aprovação históricas.
- Melhoria: compara a proporção de acertos com o primeiro pré-teste e aplica
  `post_test_improvement` (6 pontos) uma única vez por usuário. Não exige aprovação,
  mas exige melhoria mensurável. Também respeita `post_test_improvement_awards`.
- Regras inativas não concedem pontos; limites inativos deixam de ser exigidos.
  Aprovação desativada remove o corte, sem restaurar 70%. Configuração ausente ou
  valor ativo pendente retorna 409; zero continua sendo zero.

Concessões ficam em `LearningAward`, com valor aplicado e data da liberação,
protegidas por transações serializáveis e unicidade. Módulos excedentes entram
em fila, respeitando `training_modules_daily` (2) e `training_points_daily` (4),
por usuário e dia de Fortaleza. A fila preserva o valor da conclusão e consulta
os limites atuais. Reativar regra não transforma conclusões de zero em pontos.
Novas conclusões tentam liberar a fila; o aplicativo também pode chamar
`POST /api/v1/progress/learning-awards/claim` nos dias seguintes, retornando
`pointsReleased`. Não existe processo em segundo plano para essa liberação.
Se um prêmio individual exceder o teto diário, ele fica pendente até revisão do teto.
O campo `moduleCompletion` em aprendizado/resultados mostra pontos liberados e
pendentes. `totalPoints` soma as concessões efetivas do módulo, inclusive em
outras tentativas; não soma apenas a tentativa mais recente.

O aplicativo consulta e libera a fila ao abrir a trilha, o extrato ou a conclusão
do módulo. A liberação reconcilia os dias já transcorridos desde cada conclusão,
respeitando os limites atuais por dia de Fortaleza e preservando o valor original
de cada concessão. Não altera transações já liberadas.

- `GET /api/v1/progress/learning`: pontos de aprendizado liberados, pendentes,
  limites diários e previsão da próxima liberação.
- `GET /api/v1/progress/learning/history?offset=0&limit=20`: histórico paginado
  das concessões de aprendizado do próprio usuário. Pontos de relatos não entram
  nesse resumo. As telas `/trilha` e `/pontos` usam esses dados reais.

### Conclusão e certificado da trilha

- `GET /api/v1/trails/:trailId/completion`: progresso, disponibilidade da prova
  final, último resultado e certificado do próprio usuário.
- `POST /api/v1/trails/:trailId/certificate`: emite ou retorna o certificado
  existente. Exige todos os módulos publicados concluídos, prova final aprovada
  e recompensa de certificado ativa. Não exige saldo mínimo nem concede pontos.

Todas essas operações exigem autenticação e usam o usuário da sessão, sem aceitar
um identificador de outro usuário. A tela `/modulo/prova-final` apresenta a espera,
aplica a prova pela API e permite emitir e compartilhar o certificado e selo.
A migration `20261017160000_trail_certificates` preserva nome e título na emissão;
novas chamadas retornam o mesmo certificado. O compartilhamento é textual; geração
de PDF e validação pública de certificados ainda não estão implementadas.

Prova final autenticada da trilha:

- `GET /api/v1/trails/:trailId/final-exam`: perguntas sem gabarito de todos os
  módulos publicados da trilha, reutilizando o banco de questões existente.
- `POST /api/v1/trails/:trailId/final-exam`: envia `answers` com `questionId` e
  `optionId`; corrige no servidor e grava uma tentativa própria.

Exige concluir todos os módulos publicados e cumprir `final_exam_delay`
(inicialmente 24 horas após a última conclusão). A aprovação usa o percentual
administrativo e concede `final_exam` (10 pontos) uma única vez por usuário/trilha,
respeitando `final_exam_awards`. Os limites de concessão podem suspender novas
concessões com zero; não multiplicam eventos definidos como únicos.
Repetições de pós-teste e prova final consultam `quiz_retry_interval`: seu valor
padrão é de 30 segundos, ajustável ou desativável no painel. A migration
`20261017140000_quiz_retry_default` preenche somente valores pendentes, preserva
valores já definidos e registra a alteração no histórico de configuração.
Com aprovação em 80% e três perguntas, são necessários três acertos (arredondamento
para cima); dois acertos representam 66,7%. Após reprovação, o aplicativo mostra
o resultado e permite revisar o treinamento ou iniciar explicitamente outra tentativa.
Erros de configuração não exibem nomes internos, e a espera informa os segundos restantes.
Conflitos concorrentes retornam 409; consulte o estado e repita a operação.

### Proteção do histórico de quizzes

Aplique `npm run db:deploy` para instalar a migration
`20261017030000_preserve_quiz_answers`. Ela impede excluir perguntas e alternativas
com respostas vinculadas. A API também recusa substituir quizzes com qualquer
tentativa, inclusive aberta sem respostas, retornando `409 CONTENT_CONFLICT`.
O início das tentativas e a substituição usam transações serializáveis para
tratar disputas concorrentes. Consulte [administração de conteúdo](docs/content-administration.md).

### Identificação das tentativas de pós-teste

Aplique `npm run db:deploy` antes de iniciar a API atualizada. A migration
`20261017040000_single_open_post_attempt` reconcilia tentativas abertas duplicadas
com auditoria e preservação das respostas, mantendo somente a mais recente aberta,
e cria o índice único parcial. O índice parcial é mantido explicitamente em SQL;
não o substitua por uma unicidade que também alcance tentativas concluídas.

O cliente deve obter `attemptId` em `GET /api/v1/modules/:moduleId/quiz/pos`
e enviá-lo no corpo das respostas e da finalização. O envio de respostas já não
abre uma tentativa automaticamente. Em caso de 409 durante uma abertura concorrente,
consulte novamente o pós-teste para obter a tentativa vigente. Consulte os corpos
atualizados em [administração de conteúdo](docs/content-administration.md).

### Tempo de leitura dos módulos

A API estima a leitura a 200 palavras por minuto, em segundos, usando o conteúdo do módulo ou o texto das etapas/cards quando o módulo exige quiz e possui treinamento estruturado. A estimativa é uma convenção do produto. O campo `readingSeconds` do progresso é exibido no detalhe do módulo. O limite `module_minimum_time` continua sendo um percentual, agora aplicado a essa estimativa em vez de `durationMinutes`. A duração cadastrada permanece como metadado editorial. O tempo mínimo continua contando de `startedAt`; ao tentar concluir antes dele, a API informa o tempo restante. Sem alteração de schema ou migration.


Para reiniciar o Expo sem o cache do Metro, execute `npm run dev:mobile -- --clear --lan`. O script da raiz repassa os argumentos ao workspace mobile; confirme que a saída mostra `expo start --clear --lan`. Reabra no Expo Go o projeto servido por essa sessão.


O seed de demonstração também acrescenta a etapa `DO_NOT` (O que NÃO fazer) quando identifica exatamente as duas etapas originais, sem edição de títulos, introduções, durações ou cartões. Novas execuções não duplicam a etapa. Quizzes, tentativas e conclusões existentes são preservados. A tela de conclusão consulta novamente o progresso confirmado pela API, os pontos efetivamente concedidos e os pendentes; o espaço de progresso mostra módulos concluídos da trilha, pois ainda não há contrato de patentes. O botão Reportar abre a entrada já existente na trilha; o formulário de envio continua pendente.
