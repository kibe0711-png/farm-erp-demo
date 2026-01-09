-- CreateTable
CREATE TABLE "nutri_sop" (
    "id" SERIAL NOT NULL,
    "crop_code" TEXT NOT NULL,
    "week" INTEGER NOT NULL,
    "products" TEXT NOT NULL,
    "active_ingredient" TEXT NOT NULL,
    "rate_litre" DECIMAL(10,4) NOT NULL,
    "rate_ha" DECIMAL(10,4) NOT NULL,
    "unit_price_rwf" DECIMAL(12,2) NOT NULL,
    "cost" DECIMAL(12,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nutri_sop_pkey" PRIMARY KEY ("id")
);
