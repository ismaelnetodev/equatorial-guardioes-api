-- Pós-teste aprovado: só ajusta module_quiz quando ainda está em 0,
-- para não sobrescrever valor já definido no painel admin.
UPDATE "ProgramConfiguration"
SET
  "value" = 4,
  "description" = 'Pontos concedidos uma vez por módulo ao aprovar o pós-teste. Valor sugerido: 4 (validar com a equipe).'
WHERE "key" = 'module_quiz' AND "kind" = 'RULE' AND "value" = 0;
