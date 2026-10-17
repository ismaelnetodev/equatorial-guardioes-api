ALTER TABLE "Report" ADD COLUMN "confirmedRisk" "ReportUrgency", ADD COLUMN "validatedAt" TIMESTAMP(3);
CREATE INDEX "Report_userId_validatedAt_idx" ON "Report"("userId", "validatedAt");
-- Preserve legacy awards before removing points unsupported by v2 validation.
CREATE TABLE "ReportLegacyPointsAudit" AS
SELECT "id" AS "reportId", "userId", "status", "urgency", "pointsAwarded", CURRENT_TIMESTAMP AS "reconciledAt"
FROM "Report" WHERE "pointsAwarded" <> 0;
ALTER TABLE "ReportLegacyPointsAudit" ADD PRIMARY KEY ("reportId");
UPDATE "Report" SET "pointsAwarded" = 0 WHERE "pointsAwarded" <> 0;
