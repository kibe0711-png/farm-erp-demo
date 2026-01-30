-- CreateTable
CREATE TABLE "harvest_schedules" (
    "id" SERIAL NOT NULL,
    "farm_phase_id" INTEGER NOT NULL,
    "week_start_date" DATE NOT NULL,
    "day_of_week" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "harvest_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "harvest_logs" (
    "id" SERIAL NOT NULL,
    "farm_phase_id" INTEGER NOT NULL,
    "log_date" DATE NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "harvest_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "harvest_schedules_farm_phase_id_week_start_date_day_of_week_key" ON "harvest_schedules"("farm_phase_id", "week_start_date", "day_of_week");
