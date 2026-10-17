BEGIN;
-- Preenche apenas o valor pendente; preserva intervalos já definidos pelo administrador.
WITH previous AS (
  SELECT * FROM "ProgramConfiguration"
  WHERE "key" = 'quiz_retry_interval' AND "kind" = 'LIMIT' AND "value" IS NULL
  FOR UPDATE
), changed AS (
  UPDATE "ProgramConfiguration" AS config
  SET "value" = 30,
      "description" = 'Aguarde 30 segundos entre tentativas de quiz. Intervalo ajustável no painel administrativo.',
      "updatedAt" = CURRENT_TIMESTAMP
  FROM previous WHERE config."key" = previous."key"
  RETURNING config.*
)
INSERT INTO "ProgramConfigurationChange" ("key", "kind", "before", "after", "reason")
SELECT changed."key", changed."kind", to_jsonb(previous), to_jsonb(changed),
       'Definição do intervalo inicial de 30 segundos para novas tentativas de quiz.'
FROM changed JOIN previous ON changed."key" = previous."key";
COMMIT;
