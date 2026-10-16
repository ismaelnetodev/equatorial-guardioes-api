CREATE TYPE "ContentStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED', 'DISABLED');
ALTER TABLE "Trail" ADD COLUMN "publicationStatus" "ContentStatus" NOT NULL DEFAULT 'DRAFT', ADD COLUMN "order" INTEGER;
ALTER TABLE "TrailModule" ADD COLUMN "publicationStatus" "ContentStatus" NOT NULL DEFAULT 'DRAFT';
-- Preserva a visibilidade dos conteúdos anteriores à administração.
UPDATE "Trail" SET "publicationStatus" = 'PUBLISHED';
UPDATE "TrailModule" SET "publicationStatus" = CASE WHEN "isActive" THEN 'PUBLISHED'::"ContentStatus" ELSE 'DISABLED'::"ContentStatus" END;
WITH ordered AS (SELECT "id", ROW_NUMBER() OVER (ORDER BY "title", "id") AS position FROM "Trail")
UPDATE "Trail" SET "order" = ordered.position FROM ordered WHERE "Trail"."id" = ordered."id";
ALTER TABLE "Trail" ALTER COLUMN "order" SET NOT NULL;
CREATE UNIQUE INDEX "Trail_order_key" ON "Trail"("order");
ALTER TABLE "Trail" ADD CONSTRAINT "Trail_order_positive" CHECK ("order" > 0);
ALTER TABLE "TrailModule" ADD CONSTRAINT "TrailModule_order_positive" CHECK ("order" > 0);
ALTER TABLE "TrailModule" ADD CONSTRAINT "TrailModule_duration_positive" CHECK ("durationMinutes" IS NULL OR "durationMinutes" > 0);
ALTER TABLE "TrailModule" ADD CONSTRAINT "TrailModule_publication_active" CHECK ("publicationStatus" <> 'PUBLISHED' OR "isActive" = true);
