-- Liga relatos ao catálogo de bairros (opcional; backfill preenche o que der match).
ALTER TABLE "Report" ADD COLUMN IF NOT EXISTS "neighborhoodId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Report_neighborhoodId_fkey'
  ) THEN
    ALTER TABLE "Report"
      ADD CONSTRAINT "Report_neighborhoodId_fkey"
      FOREIGN KEY ("neighborhoodId") REFERENCES "Neighborhood"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Report_neighborhoodId_idx" ON "Report"("neighborhoodId");
