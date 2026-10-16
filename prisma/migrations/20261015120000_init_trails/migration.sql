-- CreateTable
CREATE TABLE "Trail" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Trail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrailModule" (
    "id" UUID NOT NULL,
    "trailId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "durationMinutes" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrailModule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TrailModule_trailId_order_idx" ON "TrailModule"("trailId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "TrailModule_trailId_order_key" ON "TrailModule"("trailId", "order");

-- AddForeignKey
ALTER TABLE "TrailModule" ADD CONSTRAINT "TrailModule_trailId_fkey"
  FOREIGN KEY ("trailId") REFERENCES "Trail"("id") ON DELETE CASCADE ON UPDATE CASCADE;
