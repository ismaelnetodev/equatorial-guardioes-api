# Melhorias back-end (Guardiões da Energia)

Branch: `melhorias`  
Base: `origin/main` (`9840b7b`)  
Data do sync: 2026-10-18  
Stash: não houve alterações locais; `git stash` não foi necessário.

## 1. Estado das branches remotas

| Branch | Autor (último commit à frente) | Commits à frente de main | Arquivos de back-end | Relação com A a H |
|--------|--------------------------------|--------------------------|----------------------|-------------------|
| origin/emelly/mobile-backend-integration | (já em main) | 0 | nenhum pendente | (nenhuma) |
| origin/emelly/profile-screens | (já em main) | 0 | nenhum pendente | (nenhuma) |
| origin/feat/backend_elias | (já em main) | 0 | nenhum pendente | comunidade/relatos/aprender já na main |
| origin/feat/modulo-ia | (já em main) | 0 | nenhum pendente | (nenhuma) |
| origin/feat/painel-admin-maranhao | (já em main) | 0 | nenhum pendente | (nenhuma) |
| origin/fix/modulos | (já em main) | 0 | nenhum pendente | pontos de aprendizagem já na main |
| origin/melhorias | criada nesta entrega | ver commits | ver itens abaixo | A a H |

Todas as branches remotas analisadas estavam sem commits exclusivos em relação a `main`. Não houve reimplementação de trabalho paralelo.

## 2. Itens A a H

### A. Cadastro sem login automático

- Classificação: só front (contrato do back já correto)
- Causa: o endpoint `POST /api/v1/cadastrar` já respondia 201 sem token; o mobile chama `login()` após o cadastro em `apps/mobile/src/app/cadastrar.tsx`
- O que foi feito: schema de resposta de cadastro separado (`registerResponseSchema`) sem `accessToken`; teste de regressão
- Arquivos: `apps/api/src/modules/auth/auth.schemas.ts`, `auth.routes.ts`, `auth.registration.test.ts`
- Commit: `022dde7` `fix(back): ensure register does not issue tokens`

### B. Ranking por bairro sem pontos

- Classificação: só back-end
- Causa: (1) `maybeAwardInviteOnModule0` importado e não chamado em `completeModule`; (2) resolução de relato gravava `pointsAwarded` sem `creditPoints` no extrato/`PointAccount.accumulated`; (3) agregação usava texto `neighborhood` e podia fragmentar o mesmo bairro
- O que foi feito: convite na conclusão do módulo 0; crédito `REPORT_CONFIRM`; script `db:reconcile:neighborhood`; ranking por id de catálogo (sem match fora do ranking público); backfill `db:backfill:user-neighborhood-id`; E2E real trilha->ranking + fila
- Commits: `fd0b558`, `4d27b8c`, `6b43e86` `fix(back): backfill neighborhood ids and rank by catalog`; `9348701` `test(back): e2e ranking trail and daily cap queue`

### C. Login Google e funções sem uso

- Classificação: só front (API)
- Causa: não há OAuth/Google no back-end em nenhuma branch remota; o botão existe só no mobile (`entrar.tsx`) como stub
- O que foi feito: auditoria completa; nada removido no API (não havia código Google/OAuth)
- Commit: nenhum (sem alteração de código)

### D. Pré-teste e pós-teste

- Classificação: back-end + front
- Causa: módulo atual (PRE / treinamento / POST + `LearningAward` + `ProgramConfiguration`) é usado pelo mobile e por outras rotas
- O que foi feito: mantido o módulo; proposta documentada na seção abaixo (sem migration breaking)
- Commit: nenhum de código

### E. Cadeado na aba Reportar

- Classificação: back-end + front
- Causa: regra existia (`REPORTS_LOCKED`) mas o status não era exposto ao cliente
- O que foi feito: constante `REPORTS_UNLOCK_AFTER_INITIAL_MODULE` e helpers em `lib/reports-unlock.ts`; campo `canReport` em `GET /api/v1/perfil` e `GET /api/v1/progress/trails/:trailId`
- Confirmação: `assertModuleZeroCompleted` (guard de criação de relato) e o campo `canReport` usam a mesma função `canReport` de `lib/reports-unlock.ts`
- Arquivos: `reports-unlock.ts`, `community.*`, `progress.*`, `reports.service.ts`, testes
- Commit: `8673d3e` `feat(back): expose canReport unlock status`

### F. Ícone editar perfil

- Classificação: só front (UI); back garantido
- Causa: não existia endpoint de atualização de perfil
- O que foi feito: `PATCH /api/v1/perfil` aceita apenas `name`. Troca de bairro restrita ao admin. Não há `photoUrl` no model `User`
- Arquivos: `community.schemas.ts`, `community.service.ts`, `community.controller.ts`, `community.routes.ts`, teste
- Commits: `9dce907` `feat(back): add profile update endpoint`; `a0d71b6` `fix(back): restrict profile patch to name only`

### G. Pontos do quiz e do treinamento

- Classificação: só back-end
- Causa: regra `module_quiz` seedada com valor `0`; a fase de treinamento (`completeTraining`) gravava `trainingPointsAwarded: 0` sem regra configurável
- Inventário das etapas:

| Etapa | Regra / código | Valor seed | Observação |
|-------|----------------|------------|------------|
| Pré-teste | `submitPreTest` | 0 | Diagnóstico; não credita ledger |
| Conclusão do treinamento | `training_completion` | **3** | Fila + `training_points_daily`; **validar 3 com a equipe** |
| Pós-teste aprovado | `module_quiz` | 0 -> 4 | Pontuação direta do quiz; validar 4 com a equipe |
| Melhoria pré->pós | `post_test_improvement` | 6 (1x) | Só com melhoria mensurável |
| Conclusão do módulo | `module_completion` | 2 | Fila + limites `training_*_daily` |
| Prova final | `final_exam` | 10 | 1x |

- O que foi feito: `module_quiz` -> 4 (migration condicional); regra `training_completion` = 3 (insert se não existir); `completeTraining` enfileira e libera; scripts `db:backfill:module-quiz` e `db:backfill:training`; limites diários adiando (não descartando); respostas com `pointsCapped` / `capReason` / `pendingPoints`; fila in-process + `db:release:pending-points`; flag `POINTS_DAILY_LIMITS_ENABLED`.
- Commits: `a9577b2`, `cfc535b`, `4e4980a` `feat(back): award configurable training_completion points`; `79d0e65` `feat(back): expose daily point caps and queue consumer`

### H. Bairro no relato

- Classificação: só back-end
- Causa: `neighborhood` era obrigatório no body e não havia fallback para o bairro do usuário; texto livre não era validado no catálogo
- O que foi feito: `neighborhood` opcional; string vazia ou só espaços tratada como ausente (fallback); texto livre e id validados no catálogo de São Luís (`INVALID_NEIGHBORHOOD`); bairro na resposta e listagens
- Arquivos: `reports.schemas.ts`, `reports.service.ts`, `reports.controller.ts`, testes
- Commits: `f01f87b` `fix(back): persist report neighborhood with user fallback`; `48443a8` `fix(back): validate report neighborhood against catalog`

## 3. Itens já resolvidos em outras branches

Nenhum item A a H estava resolvido de forma completa em branch remota pendente de merge: todas as branches listadas já estavam contidas em `main`.

## 4. Mudanças de contrato da API (front/mobile)

### Cadastro (A)

- Rota: `POST /api/v1/cadastrar`
- Antes (comportamento efetivo no app): após 201 o app fazia login e gravava sessão
- Depois: 201 `{ message, user }` sem `accessToken`/`refreshToken`. O app deve ir para `/entrar` e só autenticar via `POST /api/v1/entrar`

### Perfil e progresso (E)

- `GET /api/v1/perfil`: inclui `canReport: boolean`
- `GET /api/v1/progress/trails/:trailId`: inclui `canReport: boolean`
- Front deve usar `canReport` para liberar a aba Reportar (em vez de lógica só local)

### Atualização de perfil (F)

- Nova rota: `PATCH /api/v1/perfil`
- Body: `{ name }` (apenas o nome; `neighborhood` e `neighborhoodId` não são aceitos)
- Resposta: mesmo formato de `GET /perfil` (incluindo `canReport`)
- Troca de bairro fica restrita ao admin
- Ícone caneta deve chamar este endpoint só para o nome

### Relatos (H)

- Rota: `POST /api/v1/relatos`
- Antes: `neighborhood` obrigatorio no body
- Depois: `neighborhood` e `neighborhoodId` opcionais. Regras:
  1. `neighborhoodId` no body: sempre valida no catalogo de Sao Luis (IBGE 2111300). Id inexistente -> 400 `INVALID_NEIGHBORHOOD`.
  2. Texto no body igual ao bairro do cadastro (normalizado: espacos colapsados, comparacao case-insensitive / sem diferenca de acentuacao tratada pela normalizacao do texto): aceito sem validar catalogo. Grava o texto enviado e o `neighborhoodId` do usuario (ou `null`), mesma regra do fallback.
  3. Texto no body diferente do cadastro: exige match no catalogo; sem match -> 400 `INVALID_NEIGHBORHOOD`.
  4. Sem `neighborhood` / `neighborhoodId` no body (ou string vazia / so espacos): fallback do cadastro (texto do perfil + id do usuario ou `null` se nao houver match opcional).
- Resposta e listagens: continuam com `neighborhood` (e `neighborhoodId` quando houver).
- Teste de regressao: `apps/api/src/modules/reports/reports.integration.test.ts` (body igual a "Outro bairro" do cadastro -> 201). Introduzido em `dff1f39` (o commit ja alterou o `.test.ts`; nao foi necessario recriar o caso).

### Claim

- Rota: `POST /api/v1/progress/learning-awards/claim`
- Resposta: `{ "pointsReleased": number, "pendingPoints": number }`
- Comportamento: libera apenas o que cabe no teto do dia (`training_points_daily` / `training_modules_daily`, fuso `America/Sao_Paulo`). O excedente permanece na fila (`pendingPoints`); ranking nao sobe alem do liberado.
- Conferencia mobile (`git grep -n "learning-awards/claim" -- apps/mobile`):
  - `apps/mobile/README.md` (documentacao das telas trilha e pontos)
  - `apps/mobile/src/features/trails/progress.api.ts:10` (`refreshLearningSummary` chama o claim e descarta o body; em seguida le `GET /progress/learning`)
  - `apps/mobile/src/services/api.types.ts:4309` (OpenAPI gerado tipa so `pointsReleased`)
- Conclusao: o mobile nao le campos do body do claim. O formato antigo era `{ pointsReleased }`; o atual adiciona `pendingPoints` sem remover `pointsReleased` (mudanca so aditiva). Nenhum commit de compatibilidade foi necessario.

### Quiz e progresso (G): novos campos de resposta

- `POST /api/v1/modules/:moduleId/training/complete`: alem de `pointsAwarded`, retorna `pointsCapped`, `capReason` (`"DAILY_LIMIT"` ou `null`), `pendingPoints`
- `POST /api/v1/progress/modules/:moduleId/complete`: mesmos campos opcionais quando ha credito de treino enfileirado
- Pos-teste aprovado: 4 pontos (`module_quiz`) + melhoria quando aplicavel
- Treinamento: 3 pontos (`training_completion`, validar com a equipe)
- Front: se `pointsCapped`, exibir que pontos entram na fila e saem no dia seguinte (ou apos claim / tela de pontos)

### Limites diarios de treino e fila

| key | Seed | O que conta | Ao atingir |
|-----|------|-------------|-----------|
| `training_modules_daily` | 2 | awards `module_completion` liberados no dia (por usuário) | **adia** (`grantedAt` null) |
| `training_points_daily` | **10** | pontos liberados de `module_completion` + `training_completion` no dia. Conta: 2 módulos/dia × (training_completion 3 + module_completion 2) = 10 | **adia** (não descarta) |
| `neighborhood_quiz_daily` | 3 | quizzes do bairro/dia | limite próprio (fora da fila de treino) |
| `reports_daily` | 2 | relatos pontuados/dia | limite próprio |

Migration `20261018210000_training_points_daily_10` atualiza o valor de 4 para 10 somente se ainda estiver em 4.

Consumidor da fila: **in-process** no processo da API (`POINTS_QUEUE_INTERVAL_MS`, padrão 1h; `0` desliga), mais `POST .../learning-awards/claim` e conclusão de módulo/treinamento. Não há `docker-compose` nem CronJob no repositório. Script sob demanda: `npm run db:release:pending-points -w guardioes-api`. Demo: `POINTS_DAILY_LIMITS_ENABLED=false` ignora os limites de treino.

A fila in-process só roda enquanto a API estiver ativa. No deploy, use instância sem hibernação (sempre ligada) ou agende `db:release:pending-points` externamente (cron/K8s CronJob). Virada do dia dos limites: `America/Sao_Paulo`.

## 5. Candidatos a remoção (não removidos)

| Candidato | Motivo de manter |
|-----------|------------------|
| Botão “Entrar com Google” no mobile | Fora do escopo back-end; stub sem API |
| Motivo de ledger `REPORT_SEND` | Enum/histórico; sem rota dedicada, mas usado no schema Prisma |
| Pré/pós-teste separados | Dependência do mobile e do fluxo de progresso |
| `quiz_retry_interval` e limites diários de treinamento | Configuração administrativa ativa |

## 6. Riscos de conflito no merge

Arquivos quentes nesta branch:

- `apps/api/src/modules/progress/progress.service.ts`
- `apps/api/src/modules/reports/reports.service.ts`
- `apps/api/src/modules/community/community.*`
- `apps/api/src/modules/quiz/quiz.integration.test.ts`
- `apps/api/prisma/migrations/20261018180000_module_quiz_points/`
- `apps/api/prisma/migrations/20261018210000_training_points_daily_10/`

Como as outras branches remotas estavam alinhadas com `main`, o risco atual é baixo. Se novas branches reabrirem os mesmos arquivos, preferir merges pequenos e preservar nomes de rota/campos já expostos (`canReport`, `PATCH /perfil`, `module_quiz`).

### Baseline e commits

Base da branch em relacao a `main`: `9840b7b` (`origin/main` no sync inicial).

Baseline interno `43163c2` (`chore(back): update melhorias report for pre-merge fixes`) e o ultimo commit da rodada A-H / pre-merge fixes. Os commits exclusivos entre a base e esse baseline (`git log --oneline 9840b7b..43163c2`):

```
43163c2 chore(back): update melhorias report for pre-merge fixes
48443a8 fix(back): validate report neighborhood against catalog
cfc535b fix(back): conditional module_quiz points migration
4d27b8c fix(back): rank neighborhoods by catalog id
a0d71b6 fix(back): restrict profile patch to name only
de0eb96 chore(back): document melhorias backend report
5aa24d5 fix(back): mock trail findFirst in admin progress tests
f01f87b fix(back): persist report neighborhood with user fallback
a9577b2 fix(back): ensure quiz and module stages award points
9dce907 feat(back): add profile update endpoint
8673d3e feat(back): expose canReport unlock status
fd0b558 fix(back): credit neighborhood ranking sources
022dde7 fix(back): ensure register does not issue tokens
```

A lista abaixo cobre apenas o que veio depois de `43163c2`.

### Commits na branch `melhorias` (apos baseline `43163c2`)

Rodada pontos/fila/ranking/E2E:

- `4e4980a` feat(back): award configurable training_completion points
- `79d0e65` feat(back): expose daily point caps and queue consumer
- `6b43e86` fix(back): backfill neighborhood ids and rank by catalog
- `9348701` test(back): e2e ranking trail and daily cap queue
- `364b853` docs(back): confirm shared Sao Luis neighborhood catalog
- `9575b11` docs(back): update melhorias inventory and scripts

Rodada teto 10 / E2E local / Outro bairro / ranking / claim / SP:

- `b076cc6` fix(back): raise training_points_daily to 10 for two full modules
- `3d46a64` test(back): run ranking E2E on local Postgres and document CI
- `2227f75` fix(back): allow Outro bairro fallback on report without catalog 400
- `6720515` fix(back): exclude unmatched neighborhoods from public ranking
- `d1c32d1` test(back): ensure claim endpoint respects daily point limits
- `d890744` fix(back): compute learning day boundary in America/Sao_Paulo
- `935965d` docs(back): note queue needs always-on API and remove dashes
- `045dece` docs(back): finalize qualidade counts after full suite

Rodada final de verificação:

- `dff1f39` fix(back): accept report body matching user neighborhood without catalog
- `d2b7ba1` fix(back): claim returns pendingPoints under daily cap
- `ae0df31` test(back): assert 10 pts for two modules and SP midnight fake timers
- `a53ac84` docs(back): list commits, migration and test file locations

### Onde estão os testes (claim e cenários 2 módulos / meia-noite)

- Claim respeita teto e devolve `pendingPoints`: `apps/api/src/modules/progress/progress.integration.test.ts` (`POST learning-awards/claim respeita o teto diário...`); também `apps/api/src/modules/quiz/learning-rules.test.ts` (`claim/release no mesmo dia só libera o que cabe no teto`)
- 2 módulos no mesmo dia, `pointsCapped: false`, 10 pontos creditados: `apps/api/src/modules/progress/progress.integration.test.ts` (`conclui 2 módulos no mesmo dia com teto 10 sem pointsCapped`); espelho em `learning-rules.test.ts` (`com teto 10 libera dois módulos completos`)
- Limites às 23:50 SP e liberação após 00:00 (fake timers): `apps/api/src/modules/quiz/learning-rules.test.ts` (`com limites atingidos às 23:50 SP libera pendentes após 00:00 local`)
- E2E trilha + claim: `apps/api/src/modules/community/ranking-trail.e2e.test.ts`

## 7. Migrations e scripts de correção

Runbook pos-merge (pessoa responsavel apos o merge em `main`):

```
npm run db:post-merge -w guardioes-api
```

Script: `apps/api/scripts/post-merge.sh` (npm `db:post-merge`).

1. Exige `DATABASE_URL` e confirmacao digitada `sim`, mostrando o host do banco.
2. Faz `pg_dump` em `backups/pre-melhorias-<data-hora>.sql` e aborta se falhar ou sair vazio.
3. Roda em ordem: `db:deploy`, `db:backfill:module-quiz`, `db:backfill:training`, `db:backfill:user-neighborhood-id`, `db:reconcile:neighborhood`.
4. Grava a saida de cada etapa em `backups/post-merge-<data-hora>.log` e para na primeira falha (informa a etapa e o caminho do backup).
5. Diretorio `backups/` esta no `.gitignore`.

Teste local (2026-10-18), somente Postgres `pg-e2e` em `localhost:5433` (schema recriado antes do teste; nunca outro banco):

- Confirmacao `sim` com host `localhost:5433`
- Backup `backups/pre-melhorias-20261018-155452.sql` (~110 KB, nao vazio)
- Etapas `db:deploy` ... `db:reconcile:neighborhood` OK
- Log `backups/post-merge-20261018-155452.log`
- Observacao: em banco sujo de E2E (awards orfaos), o reconcile pode falhar com FK; o script aborta corretamente. Em schema limpo + migrate, o runbook completa.

Sob demanda: `npm run db:release:pending-points -w guardioes-api`.

Sobre credito em dobro: `creditPoints` e idempotente por `(reason, sourceType, sourceId)`. `db:reconcile:neighborhood` ja chama `reconcileLearningPoints`. No pos-deploy, preferir o runbook sem repetir reconcile desnecessario.

### Demo sem limites diarios

Arquivo: `apps/api/.env.demo.example` (copie para um `.env` local de demo; nao versionar segredos).

Quando usar: apresentacoes ou demos em que a narrativa nao deve ser interrompida pela fila `training_*_daily`. Com `POINTS_DAILY_LIMITS_ENABLED=false`, o credito de treino e imediato. Em producao e homologacao reais, mantenha os limites ligados (padrao do `.env.example`).

## 8. Qualidade (pré-merge)

- `npm run typecheck`: ok (API + mobile)
- `npm test`: 37 arquivos, 344 testes passando (inclui E2E com `DATABASE_URL` no Postgres local/`pg-e2e`)
- `npm run build`: ok (API + export Expo)
- Linter ESLint: não configurado no monorepo; typecheck usado como checagem estática
- CI: `.github/workflows/delivery.yml` (já existia) sobe Postgres 17, roda `db:deploy`, `typecheck`, `npm test` (inclui E2E quando `DATABASE_URL` está definida) e `build`. Triggers: PR, push em `main`/`melhorias`, `workflow_dispatch`.

### E2E local (2026-10-18)

```
docker run -d --name pg-e2e -e POSTGRES_PASSWORD=postgres -p 5433:5432 postgres:16
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/postgres
npm run db:deploy -w guardioes-api
npm test -w guardioes-api -- src/modules/community/ranking-trail.e2e.test.ts
```

Resultado: `Test Files 1 passed (1)` · `Tests 2 passed (2)` · duração ~2.8s.
Casos: trilha->ranking (delta 3+4+2) e limite diário->`pointsCapped`->claim.

## Proposta documentada (item D): questionário único

Modelo atual: fases PRE, treinamento e POST por módulo; pontuação via `LearningAward` e `ProgramConfiguration`.

Proposta futura (não implementada nesta branch):

1. Uma entidade `Assessment` por módulo (perguntas, alternativas, score mínimo)
2. Uma tentativa com respostas e pontuação
3. Migration que copie tentativas PRE/POST existentes para o formato único
4. Deprecar rotas `/quiz/pre` e `/quiz/pos` após o mobile migrar

Motivo de não executar agora: o mobile e os fluxos de progresso/treino dependem das fases atuais; consolidar quebraria contratos em uso.

## Front/mobile (somente registro; sem alteração nesta branch)

Handoff detalhado: `docs/PENDENCIAS_FRONT.md`.

1. Apos cadastro, nao chamar `login()`; navegar para a tela de login
2. Remover ou ocultar o botao Google ate existir API
3. Consumir `canReport` no perfil/progresso para a aba Reportar
4. Ligar o icone de editar perfil a `PATCH /api/v1/perfil` (somente `name`)
5. Bairro opcional no envio de relato: pode omitir o campo (fallback do cadastro). Se enviar texto igual ao cadastro (ex.: "Outro bairro"), o back aceita sem catalogo. Texto diferente do cadastro precisa ser do catalogo ou id valido; `neighborhoodId` no body sempre valida catalogo
6. Exibir mensagem quando `pointsCapped` / `capReason: "DAILY_LIMIT"` / `pendingPoints` apos concluir treinamento ou modulo

## Catálogo de bairros (cadastro e relato)

Cadastro (`auth.service`) e relato (`reports.service`) usam a **mesma** tabela `Neighborhood`.

- Município coberto: IBGE **2111300** (São Luís/MA, seed Prefeitura de São Luís / SEMGOP 2022).
- Cadastro: `neighborhoodId` opcional; se informado, exige `municipalityCode = 2111300`; "Outro bairro" = texto sem id.
- Relato: `neighborhoodId` no body sempre valida catálogo. Texto no body igual ao bairro do cadastro (normalizado) segue a regra do fallback (grava texto + `neighborhoodId` do usuário ou nulo). Texto diferente do cadastro exige catálogo. Fallback sem body: grava texto do cadastro com id nulo se não houver match (sem 400).
- Ranking público: agrega por id de catálogo (texto sem id mapeado pelo nome normalizado). Sem match fica fora do endpoint público (não há rota admin de ranking hoje).
- Claim: `POST /api/v1/progress/learning-awards/claim` responde `{ pointsReleased, pendingPoints }` e só libera o que cabe no teto do dia (`America/Sao_Paulo`).
