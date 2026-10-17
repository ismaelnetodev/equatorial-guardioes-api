-- CreateEnum
CREATE TYPE "PointLedgerReason" AS ENUM ('QUIZ_PRE', 'QUIZ_TRAINING', 'QUIZ_POST', 'REPORT_SEND', 'REPORT_CONFIRM', 'INVITE_REWARD', 'REDEMPTION', 'BACKFILL');
CREATE TYPE "RewardRedemptionStatus" AS ENUM ('COMPLETED');

-- Unique invite codes for sharing
CREATE UNIQUE INDEX IF NOT EXISTS "User_inviteCode_key" ON "User"("inviteCode");

-- PointAccount
CREATE TABLE "PointAccount" (
    "userId" UUID NOT NULL,
    "accumulated" INTEGER NOT NULL DEFAULT 0,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PointAccount_pkey" PRIMARY KEY ("userId")
);
ALTER TABLE "PointAccount" ADD CONSTRAINT "PointAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PointAccount" ADD CONSTRAINT "PointAccount_nonnegative" CHECK ("accumulated" >= 0 AND "balance" >= 0);

-- PointLedgerEntry
CREATE TABLE "PointLedgerEntry" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "delta" INTEGER NOT NULL,
    "affectsAccumulated" BOOLEAN NOT NULL,
    "reason" "PointLedgerReason" NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PointLedgerEntry_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PointLedgerEntry_userId_createdAt_idx" ON "PointLedgerEntry"("userId", "createdAt");
CREATE UNIQUE INDEX "PointLedgerEntry_reason_sourceType_sourceId_key" ON "PointLedgerEntry"("reason", "sourceType", "sourceId");
ALTER TABLE "PointLedgerEntry" ADD CONSTRAINT "PointLedgerEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RewardRedemption
CREATE TABLE "RewardRedemption" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "rewardKey" TEXT NOT NULL,
    "pointsSpent" INTEGER NOT NULL,
    "status" "RewardRedemptionStatus" NOT NULL DEFAULT 'COMPLETED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RewardRedemption_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "RewardRedemption_userId_createdAt_idx" ON "RewardRedemption"("userId", "createdAt");
CREATE INDEX "RewardRedemption_rewardKey_createdAt_idx" ON "RewardRedemption"("rewardKey", "createdAt");
ALTER TABLE "RewardRedemption" ADD CONSTRAINT "RewardRedemption_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RewardRedemption" ADD CONSTRAINT "RewardRedemption_points_positive" CHECK ("pointsSpent" > 0);

-- InviteAttribution
CREATE TABLE "InviteAttribution" (
    "id" UUID NOT NULL,
    "inviterId" UUID NOT NULL,
    "inviteeId" UUID NOT NULL,
    "inviteCode" TEXT NOT NULL,
    "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "module0CompletedAt" TIMESTAMP(3),
    "pointsAwarded" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "InviteAttribution_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "InviteAttribution_inviteeId_key" ON "InviteAttribution"("inviteeId");
CREATE INDEX "InviteAttribution_inviterId_registeredAt_idx" ON "InviteAttribution"("inviterId", "registeredAt");
ALTER TABLE "InviteAttribution" ADD CONSTRAINT "InviteAttribution_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InviteAttribution" ADD CONSTRAINT "InviteAttribution_inviteeId_fkey" FOREIGN KEY ("inviteeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seeds de nível e convite (não sobrescreve se já existir)
INSERT INTO "ProgramConfiguration" ("key", "kind", "name", "description", "value", "unit", "isActive", "updatedAt")
VALUES
  ('invite_module0_reward', 'RULE', 'Convite: módulo 0 concluído', 'Pontos ao convidante quando o convidado conclui o módulo 0.', 50, 'points', true, CURRENT_TIMESTAMP),
  ('invite_reward_limit', 'LIMIT', 'Limite de convites pontuados', 'Máximo de convites que geram pontos por usuário.', 10, 'invites', true, CURRENT_TIMESTAMP),
  ('level_silver_threshold', 'LIMIT', 'Limite Bronze → Prata', 'Pontos acumulados mínimos para Prata.', 250, 'points', true, CURRENT_TIMESTAMP),
  ('level_gold_threshold', 'LIMIT', 'Limite Prata → Ouro', 'Pontos acumulados mínimos para Ouro.', 600, 'points', true, CURRENT_TIMESTAMP),
  ('level_platinum_threshold', 'LIMIT', 'Limite Ouro → Platina', 'Pontos acumulados mínimos para Platina.', 1200, 'points', true, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "ProgramConfigurationChange" ("id", "key", "kind", "before", "after", "reason", "createdAt")
SELECT gen_random_uuid(), c."key", c."kind", NULL,
  to_jsonb(c) || jsonb_build_object('updatedAt', to_char(c."updatedAt", 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
  'Configuração inicial: comunidade (convite e níveis)',
  CURRENT_TIMESTAMP
FROM "ProgramConfiguration" c
WHERE c."key" IN ('invite_module0_reward', 'invite_reward_limit', 'level_silver_threshold', 'level_gold_threshold', 'level_platinum_threshold')
  AND NOT EXISTS (
    SELECT 1 FROM "ProgramConfigurationChange" h WHERE h."key" = c."key" AND h."before" IS NULL
  );

-- Backfill: quiz attempts
INSERT INTO "PointLedgerEntry" ("id", "userId", "delta", "affectsAccumulated", "reason", "sourceType", "sourceId", "createdAt")
SELECT gen_random_uuid(), mp."userId", qa."pointsAwarded", true,
  CASE WHEN qa."phase"::text = 'PRE' THEN 'QUIZ_PRE'::"PointLedgerReason" ELSE 'QUIZ_POST'::"PointLedgerReason" END,
  'QuizAttempt', qa."id"::text, qa."submittedAt"
FROM "QuizAttempt" qa
JOIN "ModuleProgress" mp ON mp."id" = qa."progressId"
WHERE qa."pointsAwarded" > 0 AND qa."finishedAt" IS NOT NULL
ON CONFLICT ("reason", "sourceType", "sourceId") DO NOTHING;

-- Backfill: training points
INSERT INTO "PointLedgerEntry" ("id", "userId", "delta", "affectsAccumulated", "reason", "sourceType", "sourceId", "createdAt")
SELECT gen_random_uuid(), mp."userId", mp."trainingPointsAwarded", true, 'QUIZ_TRAINING'::"PointLedgerReason",
  'ModuleProgressTraining', mp."id"::text, COALESCE(mp."trainingCompletedAt", mp."updatedAt")
FROM "ModuleProgress" mp
WHERE mp."trainingPointsAwarded" > 0
ON CONFLICT ("reason", "sourceType", "sourceId") DO NOTHING;

-- Backfill: report points (send = first 10 if points >= 10; confirm remainder if RESOLVED)
INSERT INTO "PointLedgerEntry" ("id", "userId", "delta", "affectsAccumulated", "reason", "sourceType", "sourceId", "createdAt")
SELECT gen_random_uuid(), r."userId", LEAST(r."pointsAwarded", 10), true, 'REPORT_SEND'::"PointLedgerReason",
  'ReportSend', r."id"::text, r."submittedAt"
FROM "Report" r
WHERE r."pointsAwarded" > 0
ON CONFLICT ("reason", "sourceType", "sourceId") DO NOTHING;

INSERT INTO "PointLedgerEntry" ("id", "userId", "delta", "affectsAccumulated", "reason", "sourceType", "sourceId", "createdAt")
SELECT gen_random_uuid(), r."userId", r."pointsAwarded" - 10, true, 'REPORT_CONFIRM'::"PointLedgerReason",
  'ReportConfirm', r."id"::text, r."updatedAt"
FROM "Report" r
WHERE r."status" = 'RESOLVED' AND r."pointsAwarded" > 10
ON CONFLICT ("reason", "sourceType", "sourceId") DO NOTHING;

-- Rebuild PointAccount from ledger
INSERT INTO "PointAccount" ("userId", "accumulated", "balance", "createdAt", "updatedAt")
SELECT
  e."userId",
  COALESCE(SUM(CASE WHEN e."affectsAccumulated" THEN e."delta" ELSE 0 END), 0),
  COALESCE(SUM(e."delta"), 0),
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "PointLedgerEntry" e
GROUP BY e."userId"
ON CONFLICT ("userId") DO UPDATE SET
  "accumulated" = EXCLUDED."accumulated",
  "balance" = EXCLUDED."balance",
  "updatedAt" = CURRENT_TIMESTAMP;
