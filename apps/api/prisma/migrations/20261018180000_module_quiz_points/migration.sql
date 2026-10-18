-- Pós-teste aprovado passa a conceder pontos via regra module_quiz.
UPDATE "ProgramConfiguration"
SET
  "value" = 4,
  "description" = 'Pontos concedidos uma vez por módulo ao aprovar o pós-teste.'
WHERE "key" = 'module_quiz' AND "kind" = 'RULE';
