BEGIN;
ALTER TABLE "QuizAttempt" ADD COLUMN "minimumCorrect" INTEGER;
CREATE TABLE "LearningAward" (
  "id" UUID NOT NULL PRIMARY KEY, "userId" UUID NOT NULL, "ruleKey" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL, "moduleId" UUID, "trailId" UUID, "points" INTEGER NOT NULL,
  "grantedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "LearningAward_userId_ruleKey_sourceId_key" ON "LearningAward"("userId", "ruleKey", "sourceId");
CREATE INDEX "LearningAward_userId_ruleKey_grantedAt_idx" ON "LearningAward"("userId", "ruleKey", "grantedAt");
CREATE TABLE "FinalExamAttempt" (
 "id" UUID NOT NULL PRIMARY KEY, "userId" UUID NOT NULL, "trailId" UUID NOT NULL,
 "correctCount" INTEGER NOT NULL, "totalCount" INTEGER NOT NULL, "minimumCorrect" INTEGER NOT NULL,
 "isApproved" BOOLEAN NOT NULL, "pointsAwarded" INTEGER NOT NULL, "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "FinalExamAttempt_userId_trailId_submittedAt_idx" ON "FinalExamAttempt"("userId", "trailId", "submittedAt");
CREATE TABLE "LearningLegacyPointsAudit" (
 "sourceId" UUID NOT NULL, "sourceType" TEXT NOT NULL, "points" INTEGER NOT NULL,
 "reconciledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY ("sourceType", "sourceId")
);
INSERT INTO "LearningLegacyPointsAudit" ("sourceId", "sourceType", "points") SELECT "id", 'QUIZ', "pointsAwarded" FROM "QuizAttempt" WHERE "pointsAwarded" <> 0;
INSERT INTO "LearningLegacyPointsAudit" ("sourceId", "sourceType", "points") SELECT "id", 'TRAINING', "trainingPointsAwarded" FROM "ModuleProgress" WHERE "trainingPointsAwarded" <> 0;
UPDATE "QuizAttempt" SET "pointsAwarded" = 0 WHERE "pointsAwarded" <> 0;
UPDATE "ModuleProgress" SET "trainingPointsAwarded" = 0 WHERE "trainingPointsAwarded" <> 0;
-- Preserva aprovação e progresso históricos; não reatribui pontos sem critérios comprovados.

COMMIT;
