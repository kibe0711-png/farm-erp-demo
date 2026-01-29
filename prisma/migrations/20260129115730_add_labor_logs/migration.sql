-- CreateTable
CREATE TABLE "labor_logs" (
    "id" SERIAL NOT NULL,
    "farm_phase_id" INTEGER NOT NULL,
    "log_date" DATE NOT NULL,
    "task" TEXT NOT NULL,
    "casuals" INTEGER NOT NULL,
    "cost_per_day" DECIMAL(10,2) NOT NULL,
    "total_cost" DECIMAL(12,2) NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "labor_logs_pkey" PRIMARY KEY ("id")
);
