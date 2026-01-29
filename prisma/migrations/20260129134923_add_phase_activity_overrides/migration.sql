-- CreateTable
CREATE TABLE "phase_activity_overrides" (
    "id" SERIAL NOT NULL,
    "farm_phase_id" INTEGER NOT NULL,
    "sop_id" INTEGER NOT NULL,
    "sop_type" VARCHAR(10) NOT NULL,
    "action" VARCHAR(10) NOT NULL,
    "week_start" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "phase_activity_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "phase_activity_overrides_farm_phase_id_sop_id_sop_type_week_key" ON "phase_activity_overrides"("farm_phase_id", "sop_id", "sop_type", "week_start");
