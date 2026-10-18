ALTER TABLE "QuizQuestion" ADD COLUMN "phase" "QuizPhase";
ALTER TABLE "QuizQuestion" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
