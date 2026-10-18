# Melhorias back-end (Guardiões da Energia)

Branch: `melhorias`  
Base: `origin/main` (`9840b7b`)  
Data do sync: 2026-10-18  
Stash: não houve alterações locais; `git stash` não foi necessário.

## 1. Estado das branches remotas

| Branch | Autor (último commit à frente) | Commits à frente de main | Arquivos de back-end | Relação com A–H |
|--------|--------------------------------|--------------------------|----------------------|-----------------|
| origin/emelly/mobile-backend-integration | (já em main) | 0 | nenhum pendente | — |
| origin/emelly/profile-screens | (já em main) | 0 | nenhum pendente | — |
| origin/feat/backend_elias | (já em main) | 0 | nenhum pendente | comunidade/relatos/aprender já na main |
| origin/feat/modulo-ia | (já em main) | 0 | nenhum pendente | — |
| origin/feat/painel-admin-maranhao | (já em main) | 0 | nenhum pendente | — |
| origin/fix/modulos | (já em main) | 0 | nenhum pendente | pontos de aprendizagem já na main |
| origin/melhorias | (não existia no sync) | criada nesta entrega | ver itens abaixo | A–H |

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
- Causa: (1) `maybeAwardInviteOnModule0` importado e não chamado em `completeModule`; (2) resolução de relato gravava `pointsAwarded` sem `creditPoints` no extrato/`PointAccount.accumulated`
- O que foi feito: chamada do convite na conclusão do módulo 0; crédito `REPORT_CONFIRM` na primeira resolução com pontos; script idempotente `db:reconcile:neighborhood`
- Arquivos: `progress.service.ts`, `reports.service.ts`, `lib/reconcile-neighborhood-points.ts`, `scripts/reconcile-neighborhood-points.ts`, testes e `package.json`
- Commit: `fd0b558` `fix(back): credit neighborhood ranking sources`

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
- Arquivos: `reports-unlock.ts`, `community.*`, `progress.*`, `reports.service.ts`, testes
- Commit: `8673d3e` `feat(back): expose canReport unlock status`

### F. Ícone editar perfil

- Classificação: só front (UI); back garantido
- Causa: não existia endpoint de atualização de perfil
- O que foi feito: `PATCH /api/v1/perfil` com `name`, `neighborhood`, `neighborhoodId` (validação alinhada ao cadastro). Não há `photoUrl` no model `User`
- Arquivos: `community.schemas.ts`, `community.service.ts`, `community.controller.ts`, `community.routes.ts`, teste
- Commit: `9dce907` `feat(back): add profile update endpoint`

### G. Pontos do quiz em algumas etapas

- Classificação: só back-end
- Causa: regra `module_quiz` seedada com valor `0` (“não pontua”), então pós-teste aprovado com todas as respostas certas não creditava pontos (exceto melhoria pontual)
- O que foi feito: migration `20261018180000_module_quiz_points` define `module_quiz = 4`; script `db:backfill:module-quiz` para tentativas já aprovadas; testes atualizados
- Arquivos: migration, `backfill-module-quiz-awards.ts`, `quiz.integration.test.ts`, `package.json`
- Commit: `a9577b2` `fix(back): ensure quiz and module stages award points`

### H. Bairro no relato

- Classificação: só back-end
- Causa: `neighborhood` era obrigatório no body e não havia fallback para o bairro do usuário
- O que foi feito: `neighborhood` opcional; `neighborhoodId` opcional com validação de catálogo; fallback para `User.neighborhood`; bairro permanece na resposta e listagens
- Arquivos: `reports.schemas.ts`, `reports.service.ts`, `reports.controller.ts`, testes
- Commit: `f01f87b` `fix(back): persist report neighborhood with user fallback`

## 3. Itens já resolvidos em outras branches

Nenhum item A–H estava resolvido de forma completa em branch remota pendente de merge: todas as branches listadas já estavam contidas em `main`.

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
- Depois: `neighborhood` e `neighborhoodId` opcionais; se omitidos, usa o bairro do cadastro; `neighborhoodId` inválido → 400 `INVALID_NEIGHBORHOOD`
- Resposta/listagens: continuam com `neighborhood`

### Quiz (G)

- Comportamento: pós-teste aprovado passa a conceder 4 pontos (`module_quiz`), além da melhoria quando aplicável
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

Na pasta `apps/api` (com `DATABASE_URL` configurada):

```bash
npm run db:deploy
# ou, em desenvolvimento:
npm run db:migrate
```

Recálculo idempotente de pontos/ranking (aprendizagem + convites + relatos resolvidos):

```bash
npm run db:reconcile:neighborhood
```

Backfill de prêmios `module_quiz` para pós-testes já aprovados sem LearningAward:

```bash
npm run db:backfill:module-quiz
```

Reconciliação apenas de aprendizagem (já existente):

```bash
npm run db:reconcile:points
```

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
4. Ligar o ícone de editar perfil a `PATCH /api/v1/perfil`
5. Aceitar bairro opcional no envio de relato (fallback no back)
