-- CreateTable
CREATE TABLE "farm_phases" (
    "id" SERIAL NOT NULL,
    "crop_code" VARCHAR(50) NOT NULL,
    "phase_id" VARCHAR(50) NOT NULL,
    "sowing_date" DATE NOT NULL,
    "farm" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "farm_phases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "labor_sop" (
    "id" SERIAL NOT NULL,
    "crop_code" VARCHAR(50) NOT NULL,
    "week" INTEGER NOT NULL,
    "task" VARCHAR(255) NOT NULL,
    "no_of_casuals" INTEGER NOT NULL,
    "cost_per_casual_day" DECIMAL(10,2) NOT NULL,
    "no_of_days" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "labor_sop_pkey" PRIMARY KEY ("id")
);
