import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });
if (!process.env.DATABASE_URL) {
  dotenv.config({ path: path.resolve(__dirname, "../.env") });
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL as string });
const prisma = new PrismaClient({ adapter });

// Categorisation based on CSV files in /Downloads/Inventory upload/Feeding csv/
const categoryMap: Record<string, string[]> = {
  Fertiliser: [
    "CAN",
    "DAP",
    "NPK 17.17.17",
    "UREA 46",
    "Urea",
    "Menno Florades 90 SL",
    "Potassium Sulfate/ sulfate of potash",
  ],
  "Foliar Fertiliser": [
    "Calcium Nitrate",
    "Calcibor",
    "Calmabor",
    "Di-Grow Starter",
    "Easygro Fruits and flowers",
    "Fastgrow High K",
    "Fastgrow High P",
    "Fastgrow Standard",
    "Potassium Nitrate",
    "Superfeed Calcium",
    "Wuxal",
    "Amicef",
  ],
  Pesticide: [
    "Aceta 20SL",
    "Agropy",
    "Agrothrin",
    "Deltamax",
    "Dudumectin",
    "L-Bencol",
    "Lambdex 2.5%",
    "Lambdex 5%",
    "Nimbicidine",
    "Protector",
    "Romaxtyn Gold",
    "Supra",
    "Termistop",
    "Thiamedol",
    "Abamet",
  ],
  Fungicide: [
    "Amstar",
    "Azoxyl Plus",
    "Carbendazim",
    "Falco Stick",
    "Halt Neo",
    "Hydrogen Peroxide",
    "Koxide",
    "METACOP 450 WP",
    "Metacop",
    "Nordox Super",
    "Ortiva top",
    "Rumsurf",
    "SAFARIMAX",
    "Seed Guard/Apron star",
    "Sulfit",
    "Tebucon",
    "Thiovit",
    "Warrior",
  ],
  "Farm Input": [
    "Fine Compost",
    "Manure",
    "Mulch",
    "Nails",
    "Peat Moss",
    "Ropes (Plastic Twine)",
    "SEEDS",
    "Seeds",
    "seeds (5 grams equals 1000seeds)",
    "seeds (Kg)",
    "seeds (Number of seeds)",
    "Stakes",
    "Used Oil",
    "Wires",
  ],
};

async function main() {
  console.log("=== Categorising NutriSop Products ===\n");

  let total = 0;
  for (const [category, products] of Object.entries(categoryMap)) {
    let catCount = 0;
    for (const product of products) {
      const result = await prisma.nutriSop.updateMany({
        where: { products: product },
        data: { category },
      });
      catCount += result.count;
    }
    console.log(`${category}: ${catCount} records (${products.length} products)`);
    total += catCount;
  }

  // Check for uncategorised
  const uncategorised = await prisma.nutriSop.findMany({
    where: { category: null },
    select: { products: true },
    distinct: ["products"],
  });

  console.log(`\nTotal categorised: ${total} records`);
  if (uncategorised.length > 0) {
    console.log(`\nWARNING: ${uncategorised.length} uncategorised products:`);
    uncategorised.forEach((p) => console.log(`  - ${p.products}`));
  } else {
    console.log("All products categorised!");
  }

  // Summary
  const summary = await prisma.nutriSop.groupBy({
    by: ["category"],
    _count: true,
    orderBy: { category: "asc" },
  });
  console.log("\n=== Category Summary ===");
  summary.forEach((s) =>
    console.log(`  ${s.category || "(null)"}: ${s._count} records`)
  );
}

main().catch(console.error).finally(() => prisma.$disconnect());
