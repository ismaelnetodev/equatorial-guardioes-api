-- Teto diário coerente: 2 módulos/dia × (training_completion 3 + module_completion 2) = 10.
-- Só atualiza se ainda estiver no seed antigo (4), para não sobrescrever ajuste admin.
UPDATE "ProgramConfiguration"
SET
  "value" = 10,
  "description" = 'Por usuário. 2 módulos/dia × 5 pts (training_completion 3 + module_completion 2) = 10. Excedentes adiados.'
WHERE "key" = 'training_points_daily' AND "kind" = 'LIMIT' AND "value" = 4;
