BEGIN;
-- Impede novas tentativas/respostas durante a reconciliação e a criação do índice.
LOCK TABLE "QuizAttempt", "QuizAnswer" IN ACCESS EXCLUSIVE MODE;
ALTER TABLE "QuizAttempt" ADD COLUMN "supersededAt" TIMESTAMP(3);
CREATE TABLE "QuizAttemptReconciliation" (
  "attemptId" UUID NOT NULL PRIMARY KEY,
  "retainedAttemptId" UUID NOT NULL,
  "previousState" JSONB NOT NULL,
  "reconciledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
-- Mantém a tentativa mais recente, que era a escolha do fluxo anterior; ID desempata.
CREATE TEMP TABLE "open_post_ranking" ON COMMIT DROP AS
SELECT "id", FIRST_VALUE("id") OVER (PARTITION BY "progressId" ORDER BY "submittedAt" DESC, "id" DESC) AS "retainedId",
ROW_NUMBER() OVER (PARTITION BY "progressId" ORDER BY "submittedAt" DESC, "id" DESC) AS "position"
FROM "QuizAttempt" WHERE "phase" = 'POST' AND "finishedAt" IS NULL;
INSERT INTO "QuizAttemptReconciliation" ("attemptId", "retainedAttemptId", "previousState")
SELECT a."id", r."retainedId", to_jsonb(a)
FROM "QuizAttempt" a JOIN "open_post_ranking" r ON r."id" = a."id" WHERE r."position" > 1;
-- Não remove nem transfere respostas; tentativas substituídas saem dos resultados e aprovações.
UPDATE "QuizAttempt" a SET "finishedAt" = CURRENT_TIMESTAMP, "supersededAt" = CURRENT_TIMESTAMP
FROM "open_post_ranking" r WHERE a."id" = r."id" AND r."position" > 1;
CREATE UNIQUE INDEX "QuizAttempt_one_open_post_per_progress" ON "QuizAttempt" ("progressId")
WHERE "phase" = 'POST' AND "finishedAt" IS NULL;
COMMIT;
