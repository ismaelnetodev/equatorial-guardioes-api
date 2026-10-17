CREATE TABLE "TrailCertificate" (
  "id" UUID NOT NULL PRIMARY KEY,
  "userId" UUID NOT NULL,
  "trailId" UUID NOT NULL,
  "holderName" TEXT NOT NULL,
  "trailTitle" TEXT NOT NULL,
  "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "TrailCertificate_userId_trailId_key" ON "TrailCertificate"("userId", "trailId");
