-- CreateTable
CREATE TABLE "crop_key_inputs" (
    "id" SERIAL NOT NULL,
    "crop_code" TEXT NOT NULL,
    "nursery_days" INTEGER NOT NULL,
    "outgrowing_days" INTEGER NOT NULL,
    "yield_per_ha" DECIMAL(10,2) NOT NULL,
    "harvest_weeks" INTEGER NOT NULL,
    "reject_rate" DECIMAL(5,2) NOT NULL,
    "wk1" DECIMAL(10,4),
    "wk2" DECIMAL(10,4),
    "wk3" DECIMAL(10,4),
    "wk4" DECIMAL(10,4),
    "wk5" DECIMAL(10,4),
    "wk6" DECIMAL(10,4),
    "wk7" DECIMAL(10,4),
    "wk8" DECIMAL(10,4),
    "wk9" DECIMAL(10,4),
    "wk10" DECIMAL(10,4),
    "wk11" DECIMAL(10,4),
    "wk12" DECIMAL(10,4),
    "wk13" DECIMAL(10,4),
    "wk14" DECIMAL(10,4),
    "wk15" DECIMAL(10,4),
    "wk16" DECIMAL(10,4),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crop_key_inputs_pkey" PRIMARY KEY ("id")
);
