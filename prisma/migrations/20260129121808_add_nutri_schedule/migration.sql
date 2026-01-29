-- CreateTable
CREATE TABLE "nutri_schedules" (
    "id" SERIAL NOT NULL,
    "farm_phase_id" INTEGER NOT NULL,
    "nutri_sop_id" INTEGER NOT NULL,
    "week_start_date" DATE NOT NULL,
    "day_of_week" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nutri_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "nutri_schedules_farm_phase_id_nutri_sop_id_week_start_date__key" ON "nutri_schedules"("farm_phase_id", "nutri_sop_id", "week_start_date", "day_of_week");
