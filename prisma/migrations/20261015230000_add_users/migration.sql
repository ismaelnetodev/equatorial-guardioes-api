-- CreateTable
CREATE TABLE "User" (
  "id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT,
  "cellphone" TEXT,
  "passwordHash" TEXT NOT NULL,
  "neighborhood" TEXT NOT NULL,
  "inviteCode" TEXT,
  "termsAcceptedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_cellphone_key" ON "User"("cellphone");

ALTER TABLE "ModuleProgress" ADD CONSTRAINT "ModuleProgress_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
