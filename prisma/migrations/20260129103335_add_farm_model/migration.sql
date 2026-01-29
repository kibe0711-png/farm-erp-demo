-- AlterTable
ALTER TABLE "farm_phases" ADD COLUMN     "farm_id" INTEGER;

-- CreateTable
CREATE TABLE "farms" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "labor_rate_per_day" DECIMAL(10,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "farms_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "farms_name_key" ON "farms"("name");

-- Backfill: create Farm rows from distinct farm names in farm_phases
INSERT INTO "farms" ("name")
SELECT DISTINCT "farm" FROM "farm_phases"
WHERE "farm" IS NOT NULL AND "farm" != ''
ON CONFLICT ("name") DO NOTHING;

-- Backfill: link existing farm_phases to their Farm record
UPDATE "farm_phases" fp
SET "farm_id" = f."id"
FROM "farms" f
WHERE fp."farm" = f."name";

-- AddForeignKey
ALTER TABLE "farm_phases" ADD CONSTRAINT "farm_phases_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "farms"("id") ON DELETE SET NULL ON UPDATE CASCADE;
