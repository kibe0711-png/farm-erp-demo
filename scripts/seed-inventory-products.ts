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

// Non-SOP products from CSV files in /Downloads/Inventory upload/
// Feeding CSVs are ignored — NutriSop products come from DB
const NON_SOP_PRODUCTS: { product: string; category: string; unit: string }[] = [
  // seeds.csv
  { product: "Fine beans - Twiga", category: "Seeds", unit: "Kg" },
  { product: "Fine beans - Star 2054", category: "Seeds", unit: "Kg" },
  { product: "Fine beans - Vanilla", category: "Seeds", unit: "Kg" },
  { product: "Fine beans - Boston", category: "Seeds", unit: "Kg" },
  { product: "Fine beans - Lavezzi", category: "Seeds", unit: "kg" },
  { product: "Fine beans - Catalina", category: "Seeds", unit: "kg" },
  { product: "Peas", category: "Seeds", unit: "kg" },
  { product: "Red chilli - Red thunder F1", category: "Seeds", unit: "g" },
  { product: "Green chilli - Bandai F1", category: "Seeds", unit: "kg" },
  { product: "Baby corn - SG18", category: "Seeds", unit: "g" },
  { product: "Broccoli - Inspiration F1", category: "Seeds", unit: "g" },

  // Fuel.csv
  { product: "Petrol (Essance)", category: "Fuel", unit: "L" },
  { product: "Diesel", category: "Fuel", unit: "L" },
  { product: "Lubricant oil", category: "Fuel", unit: "L" },

  // Traps.csv
  { product: "Delta trap", category: "Traps", unit: "Pc" },
  { product: "FCM pherodis", category: "Traps", unit: "Pc" },
  { product: "Ibenzole (emmamectin)", category: "Traps", unit: "Pc" },

  // irrigation materials.csv
  { product: "Water Pump (Dayliff)", category: "Irrigation", unit: "Pc" },
  { product: "Water Pump (Koshin)", category: "Irrigation", unit: "Pc" },
  { product: "Submersible solar pump", category: "Irrigation", unit: "Pc" },
  { product: "Solar panel plate", category: "Irrigation", unit: "Pc" },
  { product: "Hose Pipes (2inch)", category: "Irrigation", unit: "Pc" },
  { product: "Hose Pipes (25mm)", category: "Irrigation", unit: "Rolls" },
  { product: "Hose Pipes (50mm)", category: "Irrigation", unit: "Rolls" },
  { product: "Hose Pipes (70mm)", category: "Irrigation", unit: "Rolls" },
  { product: "Hose Pipes (63mm)", category: "Irrigation", unit: "Rolls" },
  { product: "Hose Pipes (90mm)", category: "Irrigation", unit: "Rolls" },
  { product: "Couplers (PVC)", category: "Irrigation", unit: "Pc" },
  { product: "PVC Holder", category: "Irrigation", unit: "Packet" },
  { product: "PVC Glue", category: "Irrigation", unit: "Can" },
  { product: "Gum", category: "Irrigation", unit: "Rolls" },
  { product: "Valves (25mm)", category: "Irrigation", unit: "Pc" },
  { product: "Valves (50mm)", category: "Irrigation", unit: "Pc" },
  { product: "Valves (63mm)", category: "Irrigation", unit: "Pc" },
  { product: "Valves (70mm)", category: "Irrigation", unit: "Pc" },
  { product: "Valves (90mm)", category: "Irrigation", unit: "Pc" },
  { product: "T-Connector (Big)", category: "Irrigation", unit: "Pc" },
  { product: "T-Connector (Small)", category: "Irrigation", unit: "Pc" },
  { product: "Elbows", category: "Irrigation", unit: "Pc" },
  { product: "Water-Screen Filter", category: "Irrigation", unit: "Pc" },
  { product: "End Caps (Big)", category: "Irrigation", unit: "Pc" },
  { product: "End Caps (Small)", category: "Irrigation", unit: "Pc" },
  { product: "Tapping Screws", category: "Irrigation", unit: "Packet" },
  { product: "Lateral Connector", category: "Irrigation", unit: "Pc" },
  { product: "Welding Rods", category: "Irrigation", unit: "Packet" },

  // office equipments.csv
  { product: "Shelve", category: "Office Equipment", unit: "Pc" },
  { product: "Multi sockets", category: "Office Equipment", unit: "Pc" },
  { product: "Stapler", category: "Office Equipment", unit: "Pc" },
  { product: "Chairs (Wooden)", category: "Office Equipment", unit: "Pc" },
  { product: "Chairs (Office)", category: "Office Equipment", unit: "Pc" },
  { product: "Office tables", category: "Office Equipment", unit: "Pc" },
  { product: "Hand gloves", category: "Office Equipment", unit: "Pc" },

  // spraying tools & equipmetns.csv
  { product: "Knapsacks", category: "Spraying Equipment", unit: "Pc" },
  { product: "Spraying team kit (Boots)", category: "Spraying Equipment", unit: "Pc" },
  { product: "Spraying team kit (Nozzles)", category: "Spraying Equipment", unit: "Pc" },
  { product: "Spraying team kit (overall)", category: "Spraying Equipment", unit: "Pc" },
  { product: "Spraying team kit (gloves)", category: "Spraying Equipment", unit: "Pc" },
  { product: "Measuring cylinder", category: "Spraying Equipment", unit: "Pc" },
  { product: "Sprayer flag", category: "Spraying Equipment", unit: "Pc" },
  { product: "Rain gauge", category: "Spraying Equipment", unit: "Pc" },
];

// Default unit mapping for NutriSop categories
const CATEGORY_DEFAULT_UNIT: Record<string, string> = {
  Fertiliser: "kg",
  "Foliar Fertiliser": "L",
  Pesticide: "L",
  Fungicide: "L",
  "Farm Input": "Pc",
};

async function main() {
  console.log("=== Seed Inventory Products ===\n");

  // 1. Get all farms
  const farms = await prisma.farm.findMany({ select: { id: true, name: true } });
  console.log(`Farms: ${farms.map((f) => f.name).join(", ")}`);

  // 2. Get distinct NutriSop products with categories
  const sopProducts = await prisma.nutriSop.findMany({
    select: { products: true, category: true },
    distinct: ["products"],
    orderBy: { products: "asc" },
  });
  console.log(`NutriSop products: ${sopProducts.length}`);

  // Build full product list
  const allProducts: { product: string; category: string; unit: string }[] = [];

  // Add NutriSop products
  for (const sop of sopProducts) {
    const cat = sop.category || "Farm Input";
    allProducts.push({
      product: sop.products,
      category: cat,
      unit: CATEGORY_DEFAULT_UNIT[cat] || "Pc",
    });
  }

  // Add non-SOP products
  allProducts.push(...NON_SOP_PRODUCTS);

  console.log(`Total products: ${allProducts.length} (${sopProducts.length} SOP + ${NON_SOP_PRODUCTS.length} non-SOP)\n`);

  // 3. Upsert all products for each farm
  let totalCreated = 0;
  let totalSkipped = 0;

  for (const farm of farms) {
    let created = 0;
    let skipped = 0;

    for (const item of allProducts) {
      try {
        await prisma.productInventory.upsert({
          where: {
            product_farmId: {
              product: item.product,
              farmId: farm.id,
            },
          },
          update: {
            // Don't overwrite existing category/unit — only create if missing
          },
          create: {
            product: item.product,
            category: item.category,
            unit: item.unit,
            farmId: farm.id,
            quantity: 0,
          },
        });
        created++;
      } catch {
        skipped++;
      }
    }

    console.log(`  ${farm.name}: ${created} upserted, ${skipped} skipped`);
    totalCreated += created;
    totalSkipped += skipped;
  }

  // Summary
  const categories = new Map<string, number>();
  for (const p of allProducts) {
    categories.set(p.category, (categories.get(p.category) || 0) + 1);
  }

  console.log(`\n=== Done ===`);
  console.log(`Total upserted: ${totalCreated}, skipped: ${totalSkipped}`);
  console.log(`\nCategories:`);
  for (const [cat, count] of Array.from(categories.entries()).sort()) {
    console.log(`  ${cat}: ${count}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
