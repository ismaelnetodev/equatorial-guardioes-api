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
- O que foi feito: convite na conclusão do módulo 0; crédito `REPORT_CONFIRM`; script `db:reconcile:neighborhood`; ranking agrega por `neighborhoodId` (fallback normalizado se id nulo); teste E2E de delta após créditos da trilha
- Arquivos: `progress.service.ts`, `reports.service.ts`, `community.service.ts`, `lib/reconcile-neighborhood-points.ts`, scripts, testes
- Commits: `fd0b558` `fix(back): credit neighborhood ranking sources`; `4d27b8c` `fix(back): rank neighborhoods by catalog id`

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
- Causa: regra `module_quiz` seedada com valor `0`; a fase de treinamento (`completeTraining`) grava `trainingPointsAwarded: 0` sem regra de pontos por passo/card
- Inventário das etapas:

| Etapa | Regra / código | Valor seed | Observação |
|-------|----------------|------------|------------|
| Pré-teste | `submitPreTest` | 0 | Diagnóstico; não credita ledger |
| Conclusão do treinamento | `completeTraining` | 0 | Hardcoded; sem pontos por TrainingStep/Card |
| Pós-teste aprovado | `module_quiz` | 0 → 4 | Única pontuação direta do quiz |
| Melhoria pré→pós | `post_test_improvement` | 6 (1x) | Só com melhoria mensurável |
| Conclusão do módulo | `module_completion` | 2 | Fila + limites `training_*_daily` |
| Prova final | `final_exam` | 10 | 1x |

- O que foi feito: migration `20261018180000_module_quiz_points` atualiza `module_quiz` para 4 somente se `value = 0` (não sobrescreve ajuste admin); script `db:backfill:module-quiz`; testes. O valor 4 precisa de validação da equipe de produto.
- Arquivos: migration, `backfill-module-quiz-awards.ts`, `quiz.integration.test.ts`, `package.json`
- Commits: `a9577b2` `fix(back): ensure quiz and module stages award points`; `cfc535b` `fix(back): conditional module_quiz points migration`

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

- `POST /api/v1/relatos`
- Antes: `neighborhood` obrigatório
- Depois: `neighborhood` e `neighborhoodId` opcionais; vazio/espaços = fallback do cadastro; texto livre e id devem existir no catálogo; inválido → 400 `INVALID_NEIGHBORHOOD`
- Resposta/listagens: continuam com `neighborhood`

### Quiz (G)

- Comportamento: pós-teste aprovado passa a conceder 4 pontos (`module_quiz`), além da melhoria quando aplicável (valor sugerido; validar com a equipe)
- Front: continuar exibindo `pointsAwarded` / `totalPoints` do finish do pós-teste

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

Como as outras branches remotas estavam alinhadas com `main`, o risco atual é baixo. Se novas branches reabrirem os mesmos arquivos, preferir merges pequenos e preservar nomes de rota/campos já expostos (`canReport`, `PATCH /perfil`, `module_quiz`).

## 7. Migrations e scripts de correção

Ordem recomendada (em `apps/api`, com `DATABASE_URL` configurada):

1. Backup do banco
2. `npm run db:deploy`
3. `npm run db:backfill:module-quiz`
4. `npm run db:reconcile:neighborhood`

Sobre crédito em dobro: `db:reconcile:neighborhood` já chama `reconcileLearningPoints` internamente. `creditPoints` é idempotente por `(reason, sourceType, sourceId)`. Rodar `db:reconcile:points` e depois `db:reconcile:neighborhood` não duplica créditos de aprendizagem. No pós-deploy, preferir apenas `db:reconcile:neighborhood`.

Comandos auxiliares:

```bash
npm run db:migrate
npm run db:reconcile:points
```

## 8. Qualidade (pré-merge)

- `npm run typecheck`: ok (API + mobile)
- `npm test`: 35 arquivos, 324 testes, todos passando
- `npm run build`: ok (API + export Expo)
- Linter ESLint: não configurado no monorepo; typecheck usado como checagem estática

## Proposta documentada (item D): questionário único

Modelo atual: fases PRE, treinamento e POST por módulo; pontuação via `LearningAward` e `ProgramConfiguration`.

Proposta futura (não implementada nesta branch):

1. Uma entidade `Assessment` por módulo (perguntas, alternativas, score mínimo)
2. Uma tentativa com respostas e pontuação
3. Migration que copie tentativas PRE/POST existentes para o formato único
4. Deprecar rotas `/quiz/pre` e `/quiz/pos` após o mobile migrar

Motivo de não executar agora: o mobile e os fluxos de progresso/treino dependem das fases atuais; consolidar quebraria contratos em uso.

## Front/mobile (somente registro; sem alteração nesta branch)

1. Após cadastro, não chamar `login()`; navegar para a tela de login
2. Remover ou ocultar o botão Google até existir API
3. Consumir `canReport` no perfil/progresso para a aba Reportar
4. Ligar o ícone de editar perfil a `PATCH /api/v1/perfil` (somente `name`)
5. Aceitar bairro opcional no envio de relato; texto livre deve ser do catálogo (fallback no back)
6. Exibir mensagem quando `pointsCapped` / `capReason: "DAILY_LIMIT"` / `pendingPoints` após concluir treinamento ou módulo

## Catálogo de bairros (cadastro e relato)

Cadastro (`auth.service`) e relato (`reports.service`) usam a **mesma** tabela `Neighborhood`.

- Município coberto: IBGE **2111300 — São Luís/MA** (seed Prefeitura de São Luís / SEMGOP 2022).
- Cadastro: `neighborhoodId` opcional; se informado, exige `municipalityCode = 2111300`; “Outro bairro” = texto sem id.
- Relato: texto livre ou id validados no mesmo catálogo; grava `neighborhood` + `neighborhoodId`.
- Ranking: agrega por id de catálogo (texto sem id é mapeado pelo nome normalizado; sem match → bucket único “Sem bairro”).
