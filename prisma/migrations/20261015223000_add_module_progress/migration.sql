-- AlterTable
ALTER TABLE "TrailModule"
  ADD COLUMN "requiresQuiz" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "quizMinimumScore" INTEGER;

-- CreateTable
CREATE TABLE "ModuleProgress" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "moduleId" UUID NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ModuleProgress_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "QuizQuestion" (
  "id" UUID NOT NULL,
  "moduleId" UUID NOT NULL,
  "statement" TEXT NOT NULL,
  "order" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "QuizQuestion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "QuizOption" (
  "id" UUID NOT NULL,
  "questionId" UUID NOT NULL,
  "text" TEXT NOT NULL,
  "isCorrect" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "QuizOption_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "QuizAttempt" (
  "id" UUID NOT NULL,
  "progressId" UUID NOT NULL,
  "score" DOUBLE PRECISION NOT NULL,
  "isApproved" BOOLEAN NOT NULL,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "QuizAttempt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ModuleProgress_userId_moduleId_key" ON "ModuleProgress"("userId", "moduleId");
CREATE INDEX "ModuleProgress_userId_idx" ON "ModuleProgress"("userId");
CREATE INDEX "ModuleProgress_moduleId_idx" ON "ModuleProgress"("moduleId");
CREATE UNIQUE INDEX "QuizQuestion_moduleId_order_key" ON "QuizQuestion"("moduleId", "order");
CREATE INDEX "QuizAttempt_progressId_submittedAt_idx" ON "QuizAttempt"("progressId", "submittedAt");

ALTER TABLE "ModuleProgress" ADD CONSTRAINT "ModuleProgress_moduleId_fkey"
  FOREIGN KEY ("moduleId") REFERENCES "TrailModule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QuizQuestion" ADD CONSTRAINT "QuizQuestion_moduleId_fkey"
  FOREIGN KEY ("moduleId") REFERENCES "TrailModule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QuizOption" ADD CONSTRAINT "QuizOption_questionId_fkey"
  FOREIGN KEY ("questionId") REFERENCES "QuizQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QuizAttempt" ADD CONSTRAINT "QuizAttempt_progressId_fkey"
  FOREIGN KEY ("progressId") REFERENCES "ModuleProgress"("id") ON DELETE CASCADE ON UPDATE CASCADE;
