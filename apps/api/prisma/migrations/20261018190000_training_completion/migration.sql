-- Pontos por conclusão da fase de treinamento do módulo.
-- Só insere se a chave ainda não existir (não sobrescreve ajuste admin).
INSERT INTO "ProgramConfiguration" ("key", "kind", "name", "description", "value", "unit", "isActive")
SELECT
  'training_completion',
  'RULE',
  'Concluir treinamento do módulo',
  'Pontos ao concluir a fase de treinamento (cards). Valor sugerido: 3 (validar com a equipe). Excedentes respeitam training_points_daily.',
  3,
  'points',
  true
WHERE NOT EXISTS (
  SELECT 1 FROM "ProgramConfiguration" WHERE "key" = 'training_completion'
);
