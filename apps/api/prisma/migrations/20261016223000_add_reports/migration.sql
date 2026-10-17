-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('SENT', 'RECEIVED', 'IN_ANALYSIS', 'RESOLVED', 'NOT_CONFIRMED');

-- CreateEnum
CREATE TYPE "ReportUrgency" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateTable
CREATE TABLE "Report" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "neighborhood" TEXT NOT NULL,
    "photoUrl" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "status" "ReportStatus" NOT NULL DEFAULT 'SENT',
    "urgency" "ReportUrgency" NOT NULL DEFAULT 'MEDIUM',
    "pointsAwarded" INTEGER NOT NULL DEFAULT 0,
    "impactSeenAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Report_userId_submittedAt_idx" ON "Report"("userId", "submittedAt");
CREATE INDEX "Report_status_submittedAt_idx" ON "Report"("status", "submittedAt");

ALTER TABLE "Report" ADD CONSTRAINT "Report_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "ReportTimelineEvent" (
    "id" UUID NOT NULL,
    "reportId" UUID NOT NULL,
    "status" "ReportStatus" NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportTimelineEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ReportTimelineEvent_reportId_occurredAt_idx" ON "ReportTimelineEvent"("reportId", "occurredAt");

ALTER TABLE "ReportTimelineEvent" ADD CONSTRAINT "ReportTimelineEvent_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;
