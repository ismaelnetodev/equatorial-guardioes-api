CREATE TYPE "ProgramConfigurationKind" AS ENUM ('RULE', 'REWARD', 'LIMIT');

CREATE TABLE "ProgramConfiguration" (
  "key" TEXT PRIMARY KEY,
  "kind" "ProgramConfigurationKind" NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "value" INTEGER,
  "unit" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProgramConfiguration_nonnegative" CHECK ("value" IS NULL OR "value" >= 0),
  CONSTRAINT "ProgramConfiguration_percent" CHECK ("unit" <> 'percent' OR "value" <= 100),
  CONSTRAINT "ProgramConfiguration_rule_points" CHECK ("kind" <> 'RULE' OR "value" IS NOT NULL)
);
CREATE INDEX "ProgramConfiguration_kind_key_idx" ON "ProgramConfiguration" ("kind", "key");

CREATE TABLE "ProgramConfigurationChange" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "key" TEXT NOT NULL,
  "kind" "ProgramConfigurationKind" NOT NULL,
  "before" JSONB,
  "after" JSONB NOT NULL,
  "actorId" UUID,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "ProgramConfigurationChange_kind_key_createdAt_idx" ON "ProgramConfigurationChange" ("kind", "key", "createdAt");
CREATE INDEX "ProgramConfigurationChange_createdAt_id_idx" ON "ProgramConfigurationChange" ("createdAt", "id");

-- Fonte: Guardioes_da_Energia_Recompensas_v2.md. NULL = valor não definido,
-- nunca zero implícito. Critérios qualitativos não são inventados ou monetizados.
INSERT INTO "ProgramConfiguration" ("key", "kind", "name", "description", "value", "unit", "isActive") VALUES
('module_completion', 'RULE', 'Concluir módulo educativo', 'Por módulo, com tempo mínimo de permanência; excedentes liberados nos dias seguintes, respeitando limite diário.', 2, 'points', true),
('module_quiz', 'RULE', 'Quiz do módulo', 'Não pontua; aprovação apenas libera o módulo seguinte.', 0, 'points', true),
('final_exam', 'RULE', 'Prova final da trilha', 'Uma única vez, após aprovação e espera após o último módulo.', 10, 'points', true),
('post_test_improvement', 'RULE', 'Melhoria no pós-teste', 'Uma vez, com melhoria mensurável.', 6, 'points', true),
('neighborhood_quiz', 'RULE', 'Quiz do bairro', 'Respeitar limites diário de participações e mensal de pontos.', 1, 'points', true),
('report_low', 'RULE', 'Relato validado: risco baixo', 'Risco confirmado, útil e não duplicado. Sem urgência imediata.', 10, 'points', true),
('report_medium', 'RULE', 'Relato validado: risco médio', 'Risco confirmado e classificado pela equipe. Triagem/outro risco: de 0 a 25 conforme validação.', 25, 'points', true),
('report_high', 'RULE', 'Relato validado: risco alto/urgente', 'Risco confirmado; urgência definida pela equipe.', 50, 'points', true),
('preventive_action', 'RULE', 'Bônus por ação preventiva relevante', 'Opcional; somente após confirmação da utilidade pela equipe.', 10, 'points', true),
('invalid_report', 'RULE', 'Relato inválido de boa-fé', 'Sem penalidade.', 0, 'points', true),
('duplicate_report', 'RULE', 'Relato duplicado ou sem informação útil', 'Situações repetidas podem ser agrupadas.', 0, 'points', true),
('training_modules_daily', 'LIMIT', 'Módulos de treino pontuados por dia', 'Por usuário. Módulos excedentes podem ser feitos; pontos liberados nos dias seguintes.', 2, 'modules_per_day', true),
('training_points_daily', 'LIMIT', 'Pontos de treino por dia', 'Por usuário, pontos de conclusão de módulos.', 4, 'points_per_day', true),
('quiz_pass_score', 'LIMIT', 'Aprovação nos quizzes e prova final', 'Percentual mínimo de aprovação; quiz do módulo libera o seguinte.', 80, 'percent', true),
('module_minimum_time', 'LIMIT', 'Tempo mínimo no módulo', 'Aproximadamente 70% do tempo previsto.', 70, 'percent', true),
('quiz_retry_interval', 'LIMIT', 'Intervalo entre tentativas de quiz', 'O documento exige intervalo mas não define seu valor; pendente de definição.', NULL, 'seconds', true),
('final_exam_delay', 'LIMIT', 'Espera para prova final', 'Após conclusão do último módulo.', 24, 'hours', true),
('final_exam_awards', 'LIMIT', 'Concessões pela prova final', 'Uma única vez por usuário na trilha.', 1, 'awards_per_user_per_trail', true),
('post_test_improvement_awards', 'LIMIT', 'Concessões por melhoria no pós-teste', 'Uma única vez, com melhoria mensurável.', 1, 'awards_per_user', true),
('neighborhood_quiz_daily', 'LIMIT', 'Quizzes do bairro por dia', 'Por usuário.', 3, 'quizzes_per_day', true),
('neighborhood_quiz_monthly_points', 'LIMIT', 'Pontos de quiz do bairro por mês', 'Por usuário.', 20, 'points_per_month', true),
('redemption_validated_reports', 'LIMIT', 'Relatos validados para resgate', 'Qualquer prêmio exige ao menos esta quantidade de relatos validados.', 2, 'validated_reports', true),
('reports_daily', 'LIMIT', 'Relatos pontuados por dia', 'Por usuário. Emergência continua disponível.', 2, 'reports_per_day', true),
('reports_monthly', 'LIMIT', 'Relatos pontuados por mês', 'Por usuário.', 10, 'reports_per_month', true),
('physical_rewards_quarterly', 'LIMIT', 'Prêmios físicos por trimestre', 'Por pessoa.', 1, 'physical_rewards_per_quarter', true),
('campaign_budget', 'LIMIT', 'Teto de orçamento por campanha', 'Valor a definir com a Equatorial; nenhum orçamento inicial foi informado.', NULL, 'BRL_cents', true),
('bill_credit_annual_cap', 'LIMIT', 'Teto anual do crédito na fatura', 'Hipótese de fase 2; depende de aprovação formal e definição do teto anual.', NULL, 'BRL_cents', false),
('backpack_stock', 'LIMIT', 'Estoque de bolsas ou mochilas', 'Estoque limitado; quantidade não informada no documento.', NULL, 'items', true),
('certificate', 'REWARD', 'Certificado digital e selo', 'Após conclusão da trilha. Cerca de 30 pontos é estimativa de progressão, não preço de resgate.', NULL, 'trail_completion', true),
('partner_coupon', 'REWARD', 'Cupom de parceiro local', 'Parceiro cede em troca de visibilidade; custo zero.', 200, 'points', true),
('keychain', 'REWARD', 'Chaveiro ou brinde simples', 'Baixo custo, produção em lote.', 350, 'points', true),
('guardian_kit', 'REWARD', 'Camiseta ou kit Guardião', 'Custo baixo/médio; identidade e divulgação.', 700, 'points', true),
('guided_visit', 'REWARD', 'Visita guiada ao centro de operação', 'Baixo custo, tempo da equipe.', 900, 'points', true),
('voucher', 'REWARD', 'Vale-compra de pequeno valor', 'Custo médio; valor monetário a definir com o parceiro.', 1200, 'points', true),
('backpack', 'REWARD', 'Bolsa ou mochila', 'Custo médio e estoque limitado.', 1800, 'points', true),
('collective_action', 'REWARD', 'Ação coletiva do bairro', 'Kit de segurança elétrica para escola local; pontos somados pelo bairro.', 2500, 'neighborhood_points', true),
('bill_credit', 'REWARD', 'Crédito de valor fixo na fatura', 'Hipótese de fase 2. Somente com aprovação formal e teto anual. R$ 20 é exemplo, não valor confirmado.', 3500, 'points', false);

-- Registro inicial explícito; não há usuário humano responsável pela migração.
INSERT INTO "ProgramConfigurationChange" ("key", "kind", "before", "after", "reason")
SELECT "key", "kind", NULL, to_jsonb(c) || jsonb_build_object('updatedAt', to_char("updatedAt", 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')), 'Configuração inicial: Guardioes_da_Energia_Recompensas_v2.md'
FROM "ProgramConfiguration" c;
