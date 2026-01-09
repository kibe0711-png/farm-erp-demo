-- CreateTable
CREATE TABLE "feeding_records" (
    "id" SERIAL NOT NULL,
    "farm_phase_id" INTEGER NOT NULL,
    "application_date" DATE NOT NULL,
    "product" TEXT NOT NULL,
    "actual_rate_ha" DECIMAL(10,4) NOT NULL,
    "actual_qty" DECIMAL(10,4) NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feeding_records_pkey" PRIMARY KEY ("id")
);
