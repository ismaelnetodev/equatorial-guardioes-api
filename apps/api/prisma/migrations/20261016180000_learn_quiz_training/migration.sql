-- CreateEnum
CREATE TYPE "QuizPhase" AS ENUM ('PRE', 'POST');

-- CreateEnum
CREATE TYPE "TrainingStepKind" AS ENUM ('RECOGNIZE', 'DO_NOT', 'INFO');

-- AlterTable ModuleProgress
ALTER TABLE "ModuleProgress"
  ADD COLUMN "preTestCompletedAt" TIMESTAMP(3),
  ADD COLUMN "trainingCompletedAt" TIMESTAMP(3),
  ADD COLUMN "trainingPointsAwarded" INTEGER NOT NULL DEFAULT 0;

-- AlterTable QuizQuestion
ALTER TABLE "QuizQuestion"
  ADD COLUMN "explanationTitle" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "explanationBody" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "imageUrl" TEXT;

ALTER TABLE "QuizQuestion" ALTER COLUMN "explanationTitle" DROP DEFAULT;
ALTER TABLE "QuizQuestion" ALTER COLUMN "explanationBody" DROP DEFAULT;

-- AlterTable QuizAttempt
ALTER TABLE "QuizAttempt"
  ADD COLUMN "phase" "QuizPhase" NOT NULL DEFAULT 'PRE',
  ADD COLUMN "correctCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "totalCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "pointsAwarded" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "finishedAt" TIMESTAMP(3);

-- Backfill totals from existing score when present
UPDATE "QuizAttempt"
SET "totalCount" = 1,
    "correctCount" = CASE WHEN "score" >= 1 THEN 1 ELSE 0 END,
    "finishedAt" = "submittedAt";

ALTER TABLE "QuizAttempt" ALTER COLUMN "phase" DROP DEFAULT;
ALTER TABLE "QuizAttempt" ALTER COLUMN "correctCount" DROP DEFAULT;
ALTER TABLE "QuizAttempt" ALTER COLUMN "totalCount" DROP DEFAULT;

DROP INDEX IF EXISTS "QuizAttempt_progressId_submittedAt_idx";
CREATE INDEX "QuizAttempt_progressId_phase_submittedAt_idx" ON "QuizAttempt"("progressId", "phase", "submittedAt");

-- CreateTable QuizAnswer
CREATE TABLE "QuizAnswer" (
    "id" UUID NOT NULL,
    "attemptId" UUID NOT NULL,
    "questionId" UUID NOT NULL,
    "optionId" UUID NOT NULL,
    "isCorrect" BOOLEAN NOT NULL,
    "answeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuizAnswer_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "QuizAnswer_attemptId_questionId_key" ON "QuizAnswer"("attemptId", "questionId");
CREATE INDEX "QuizAnswer_attemptId_idx" ON "QuizAnswer"("attemptId");

ALTER TABLE "QuizAnswer" ADD CONSTRAINT "QuizAnswer_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "QuizAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QuizAnswer" ADD CONSTRAINT "QuizAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "QuizQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QuizAnswer" ADD CONSTRAINT "QuizAnswer_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "QuizOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable TrainingStep
CREATE TABLE "TrainingStep" (
    "id" UUID NOT NULL,
    "moduleId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "kind" "TrainingStepKind" NOT NULL DEFAULT 'INFO',
    "order" INTEGER NOT NULL,
    "durationMinutes" INTEGER,
    "introText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingStep_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TrainingStep_moduleId_order_key" ON "TrainingStep"("moduleId", "order");
CREATE INDEX "TrainingStep_moduleId_order_idx" ON "TrainingStep"("moduleId", "order");
ALTER TABLE "TrainingStep" ADD CONSTRAINT "TrainingStep_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "TrailModule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrainingStep" ADD CONSTRAINT "TrainingStep_order_positive" CHECK ("order" > 0);
ALTER TABLE "TrainingStep" ADD CONSTRAINT "TrainingStep_duration_positive" CHECK ("durationMinutes" IS NULL OR "durationMinutes" > 0);

-- CreateTable TrainingCard
CREATE TABLE "TrainingCard" (
    "id" UUID NOT NULL,
    "stepId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingCard_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TrainingCard_stepId_order_key" ON "TrainingCard"("stepId", "order");
CREATE INDEX "TrainingCard_stepId_order_idx" ON "TrainingCard"("stepId", "order");
ALTER TABLE "TrainingCard" ADD CONSTRAINT "TrainingCard_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "TrainingStep"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrainingCard" ADD CONSTRAINT "TrainingCard_order_positive" CHECK ("order" > 0);
