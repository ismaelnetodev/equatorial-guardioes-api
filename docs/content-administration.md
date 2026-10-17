# Administração de conteúdo

As operações administrativas usam o prefixo `/api/v1/admin` e exigem um token Bearer de um usuário com perfil `ADMIN`. O perfil é consultado no banco a cada requisição. Usuários sem autenticação recebem `401`; usuários autenticados sem permissão recebem `403`.

A documentação dos campos e respostas está no Swagger UI em `/documentation`, na seção Admin.

## Operações

| Método | Caminho relativo ao prefixo | Operação |
| --- | --- | --- |
| GET | `/trails` | Listar todas as trilhas, em qualquer estado. |
| GET | `/trails/:trailId` | Consultar a trilha e seus módulos, incluindo conteúdo completo. |
| POST | `/trails` | Cadastrar uma trilha em rascunho. |
| PATCH | `/trails/:trailId` | Editar título e descrição. |
| PUT | `/trails/order` | Ordenar todas as trilhas. |
| PATCH | `/trails/:trailId/status` | Publicar, arquivar, desativar ou retornar a rascunho. |
| POST | `/trails/:trailId/modules` | Cadastrar um módulo em rascunho. |
| PATCH | `/trails/:trailId/modules/:moduleId` | Editar título, descrição, conteúdo, duração e exigência de quiz. |
| PUT | `/trails/:trailId/modules/order` | Ordenar todos os módulos da trilha. |
| PATCH | `/trails/:trailId/modules/:moduleId/status` | Publicar, arquivar, desativar ou retornar a rascunho. |
| GET | `/trails/:trailId/modules/:moduleId/quiz` | Listar perguntas, alternativas e explicações do quiz. |
| PUT | `/trails/:trailId/modules/:moduleId/quiz` | Substituir perguntas somente enquanto o módulo não possuir tentativas. |
| GET | `/trails/:trailId/modules/:moduleId/training` | Listar etapas e cards do treinamento. |
| PUT | `/trails/:trailId/modules/:moduleId/training` | Substituir todas as etapas do treinamento do módulo. |
| GET | `/relatos` | Listar relatos (filtro opcional por `status`). |
| PATCH | `/relatos/:reportId/status` | Atualizar status do relato, timeline e pontos de confirmação. |

## Publicação

Envie o estado desejado às operações de status:

```json
{ "status": "PUBLISHED" }
```

Os estados são `DRAFT`, `PUBLISHED`, `ARCHIVED` e `DISABLED`. Novos conteúdos começam em `DRAFT`; a posição inicial é adicionada ao fim da coleção.

Um módulo publicado exige título, descrição e conteúdo preenchidos. Pode ser preparado e publicado enquanto sua trilha ainda é um rascunho; só aparecerá publicamente quando a trilha também estiver publicada. Publicar um módulo o reativa; desativá-lo define `isActive: false`.

Uma trilha só pode ser publicada com ao menos um módulo publicado e ativo. Para retirar o último módulo publicado de uma trilha pública, altere primeiro o estado da trilha. Arquivar ou desativar a trilha oculta seus módulos sem apagar o conteúdo ou o progresso dos usuários.

Editar conteúdo publicado altera o conteúdo disponível imediatamente. Para preparar alterações fora das consultas públicas, retorne o conteúdo a rascunho. Não há versionamento editorial ou cópia paralela de rascunho.

## Ordenação

Envie a lista completa de IDs da coleção na ordem desejada:

```json
{
  "ids": [
    "11111111-1111-4111-8111-111111111111",
    "22222222-2222-4222-8222-222222222222"
  ]
}
```

A lista deve incluir também rascunhos, arquivados e desativados. IDs repetidos, omitidos, inexistentes ou pertencentes a outra trilha são rejeitados. A operação é transacional e atribui posições a partir de 1. Conflitos concorrentes retornam `409`; atualize a coleção antes de tentar novamente.

A sequência de desbloqueio usa a ordem atual dos módulos publicados e ativos. Reordenar ou publicar novos módulos pode alterar quais conteúdos estão liberados; os registros de progresso existentes são preservados.

## Consultas públicas

As consultas públicas listam apenas trilhas publicadas e módulos publicados e ativos. Visitantes veem a estrutura sem conteúdo completo. Usuários comuns autenticados veem os módulos futuros como bloqueados, com `content: null`, até concluírem os anteriores. A mesma visibilidade é aplicada às operações de progresso para impedir acesso direto por ID a conteúdo oculto.

Administradores podem revisar conteúdos ocultos nas operações administrativas e nas consultas autenticadas de detalhes de trilhas. O catálogo público de trilhas permanece limitado ao conteúdo publicado.

## Banco de dados e integração

Aplique as migrations com `npm run db:deploy` após configurar o PostgreSQL. A migration de administração preserva como publicados os conteúdos anteriormente públicos e marca os módulos inativos como desativados. Novos registros usam rascunho como padrão.

Títulos, descrições, conteúdo, estados e posições são armazenados no banco. Alterações nesses dados não exigem modificar o código. Ao editar diretamente pelo banco, mantenha as mesmas regras de publicação da API. O banco protege referências, posições únicas e positivas, duração positiva e a exigência de que módulos publicados estejam ativos.

O perfil `ADMIN` deve ser atribuído por uma operação confiável no banco; o cadastro público não permite conceder essa permissão.

## Aprendizado (pré-teste, treinamento e pós-teste)

Módulos com `requiresQuiz: true` usam o fluxo autenticado em `/api/v1/modules/:moduleId`:

| Método | Caminho | Uso |
| --- | --- | --- |
| GET | `/learn` | Estado das etapas e pontuação parcial. |
| GET/POST | `/quiz/pre` | Perguntas sem gabarito e envio do pré-teste (só registra acertos). |
| GET | `/quiz/pre/resultado` | Resultado do pré-teste. |
| GET | `/training` | Etapas do treinamento. |
| POST | `/training/complete` | Marca o treinamento como concluído. |
| GET | `/quiz/pos` | Perguntas do pós-teste sem gabarito. |
| POST | `/quiz/pos/answers` | Uma resposta por vez, com `attemptId`, explicação e `feedbackKind` semântico (`correct` / `incorrect`). |
| POST | `/quiz/pos/finish` | Fecha a tentativa indicada por `attemptId`, compara antes/depois e aplica a nota mínima. |
| GET | `/quiz/pos/resultado` | Último resultado do pós-teste. |

Cada pergunta do quiz exige exatamente uma alternativa correta e textos de explicação (`explanationTitle`, `explanationBody`) usados só no pós-teste. A aprovação usa `quiz_pass_score` do painel de pontos e limites (inicialmente 80%). `quizMinimumScore` é legado e não sobrepõe essa configuração. A conclusão em `/api/v1/progress/modules/:moduleId/complete` consulta a aprovação do pós-teste no servidor; o cliente não pode enviar a própria nota.

## Relatos (Meus relatos)

Os relatos do Guardião usam o prefixo autenticado `/api/v1/relatos`. A criação só é liberada após a conclusão do primeiro módulo publicado da primeira trilha publicada (módulo 0).

| Método | Caminho | Uso |
| --- | --- | --- |
| POST | `/` | Criar relato (`SENT`, zero pontos, evento na timeline). |
| GET | `/` | Listar relatos do usuário com resumo (`sentCount`, `resolvedCount`, `totalPoints`). |
| GET | `/:reportId` | Detalhe com urgência, pontos e linha do tempo. |
| GET | `/impacto` | Próximo relato `RESOLVED` ainda sem impacto visto (`200` com JSON `null` se não houver). |
| POST | `/:reportId/impacto/visto` | Marca a mensagem de impacto como vista. |

Status semânticos na API: `SENT`, `RECEIVED`, `IN_ANALYSIS`, `RESOLVED`, `NOT_CONFIRMED`, cada um com `label` e `iconHint` (o app aplica ícone/cor). Ao validar e resolver (`RESOLVED`) pela administração, a pontuação segue o risco confirmado e os limites configurados; a mensagem de impacto fica disponível com os pontos efetivamente concedidos.

### Preservação das respostas do quiz

A substituição por `PUT /api/v1/admin/trails/:trailId/modules/:moduleId/quiz`
retorna `409 CONTENT_CONFLICT` se existir qualquer tentativa do módulo,
concluída ou aberta, inclusive sem respostas e mesmo com `questions: []`.
A verificação e a substituição são feitas em uma transação serializável.
A criação de tentativas também lê o conteúdo e grava a tentativa na mesma
transação serializável: em uma disputa com a edição, a operação conflitante
retorna 409 e deve ser refeita com o estado atual.

A migration `20261017030000_preserve_quiz_answers` altera as referências
`QuizAnswer.questionId` e `QuizAnswer.optionId` para `ON DELETE RESTRICT`.
Assim, o banco impede apagar perguntas e alternativas com respostas vinculadas.
A proteção não recupera respostas já apagadas por versões anteriores.
Para alterar um quiz utilizado, crie um novo módulo; edição com versões do quiz
não está implementada.

### Uma tentativa aberta de pós-teste

O `GET /api/v1/modules/:moduleId/quiz/pos` é o único caminho que abre uma
tentativa de pós-teste. Consultas posteriores reutilizam a tentativa aberta.
O banco garante no máximo uma tentativa POST com `finishedAt IS NULL` por
`progressId`, por índice único parcial criado pela migration
`20261017040000_single_open_post_attempt`. Disputas de unicidade ou serialização
retornam `409 LEARNING_CONFLICT`; faça uma nova consulta para obter o ID vigente.

Envie o `attemptId` retornado na consulta em ambas as operações:

- `POST /quiz/pos/answers`: `{ "attemptId": "UUID", "questionId": "UUID", "optionId": "UUID" }`.
- `POST /quiz/pos/finish`: `{ "attemptId": "UUID" }`.

A API valida que a tentativa pertence ao progresso do usuário e módulo, é POST
e está aberta e não foi reconciliada. IDs de outro usuário/módulo ou de tentativas
encerradas retornam 404. Omissão ou formato inválido do ID retorna 400.
Enviar uma resposta não cria outra tentativa automaticamente.

A migration mantém aberta a tentativa mais recente de cada progresso (desempate
por ID). Encerra as demais e preenche `supersededAt`, preservando suas respostas
sem transferi-las ou mesclá-las. `QuizAttemptReconciliation` registra o estado
anterior e a tentativa mantida. Tentativas reconciliadas não participam de
resultados, intervalos de nova tentativa ou aprovação de módulos. Não há
recálculo de notas nem concessão de pontos nessa reconciliação.
