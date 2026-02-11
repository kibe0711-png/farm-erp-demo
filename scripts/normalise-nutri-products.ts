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

/** Rename a product across NutriSop, FeedingRecord, and FeedingSnapshot.
 *  Handles unique constraint conflicts on FeedingSnapshot by deleting
 *  old-name duplicates where the new-name snapshot already exists. */
async function renameProduct(
  oldName: string,
  newName: string,
  extraSopData?: Record<string, string>
) {
  const sop = await prisma.nutriSop.updateMany({
    where: { products: oldName },
    data: { products: newName, ...extraSopData },
  });
  const feed = await prisma.feedingRecord.updateMany({
    where: { product: oldName },
    data: { product: newName },
  });

  // FeedingSnapshot has unique(weekStartDate, farmPhaseId, product).
  // If a snapshot already exists with newName for the same phase+week,
  // delete the old-name duplicate first to avoid constraint violation.
  const oldSnaps = await prisma.feedingSnapshot.findMany({
    where: { product: oldName },
    select: { id: true, weekStartDate: true, farmPhaseId: true },
  });
  let snapDeleted = 0;
  for (const s of oldSnaps) {
    const conflict = await prisma.feedingSnapshot.count({
      where: {
        product: newName,
        farmPhaseId: s.farmPhaseId,
        weekStartDate: s.weekStartDate,
      },
    });
    if (conflict > 0) {
      await prisma.feedingSnapshot.delete({ where: { id: s.id } });
      snapDeleted++;
    }
  }
  const snap = await prisma.feedingSnapshot.updateMany({
    where: { product: oldName },
    data: { product: newName },
  });
  const snapNote = snapDeleted > 0 ? ` (${snapDeleted} dupes removed)` : "";
  console.log(
    `  "${oldName}" → "${newName}": sop=${sop.count}, feeding=${feed.count}, snapshot=${snap.count}${snapNote}`
  );
}

/** Update only active ingredient on NutriSop (no product rename needed) */
async function updateAI(productName: string, newAI: string) {
  const sop = await prisma.nutriSop.updateMany({
    where: { products: productName },
    data: { activeIngredient: newAI },
  });
  console.log(`  "${productName}" AI → "${newAI}": ${sop.count} sop records`);
}

async function main() {
  console.log("=== NutriSop Product Normalisation ===\n");

  // 1. ACETA 20SL → Aceta 20SL
  console.log("1. Aceta 20SL casing");
  await renameProduct("ACETA 20SL", "Aceta 20SL");

  // 2. Agropyl → Agropy
  console.log("2. Agropyl → Agropy");
  await renameProduct("Agropyl", "Agropy");

  // 3. Falco stick → Falco Stick + standardise AI
  console.log("3. Falco Stick casing + AI");
  await renameProduct("Falco stick", "Falco Stick");
  await updateAI("Falco Stick", "Alkyl phenol 15%");

  // 4. Romaxtyn gold → Romaxtyn Gold + standardise AI
  console.log("4. Romaxtyn Gold casing + AI");
  await renameProduct("Romaxtyn gold", "Romaxtyn Gold", {
    activeIngredient: "Acetamiprid + Abamectin",
  });
  await updateAI("Romaxtyn Gold", "Acetamiprid + Abamectin");

  // 5. warrior → Warrior + standardise AI
  console.log("5. Warrior casing + AI");
  await renameProduct("warrior", "Warrior");
  await updateAI("Warrior", "Mancozeb + Metalaxyl");

  // 6. Lambdex variants → Lambdex 5% / Lambdex 2.5%
  console.log("6. Lambdex consolidation");
  await renameProduct("LAMBDEX 5%", "Lambdex 5%", {
    activeIngredient: "Lambda-cyhalothrin",
  });
  await renameProduct("Lambdex", "Lambdex 5%", {
    activeIngredient: "Lambda-cyhalothrin",
  });
  await renameProduct("Lambdex 5 EC", "Lambdex 5%", {
    activeIngredient: "Lambda-cyhalothrin",
  });
  await renameProduct("Lamdex 2.5", "Lambdex 2.5%", {
    activeIngredient: "Lambda-cyhalothrin",
  });

  // 7. Metacop AI standardisation (keep Metacop and METACOP 450 WP separate)
  console.log("7. Metacop AI standardisation");
  await updateAI("Metacop", "Copper + Metalaxyl");

  // 8. NPK variants → NPK 17.17.17
  console.log("8. NPK 17.17.17 consolidation");
  await renameProduct("NPK 17:17:17", "NPK 17.17.17", {
    activeIngredient: "Basal fertilizer",
  });
  await renameProduct("NPK(17:17:17)", "NPK 17.17.17", {
    activeIngredient: "Basal fertilizer",
  });

  // 9. L bencol → L-Bencol + standardise AI
  console.log("9. L-Bencol casing + AI");
  await renameProduct("L bencol", "L-Bencol", {
    activeIngredient: "Emamectin Benzoate",
  });
  await updateAI("L-Bencol", "Emamectin Benzoate");

  // 10. Fastgrow High K
  console.log("10. Fastgrow High K casing");
  await renameProduct("Fast grow high K", "Fastgrow High K");
  await renameProduct("Fastgrow high K", "Fastgrow High K");

  // 11. Fastgrow Standard
  console.log("11. Fastgrow Standard casing");
  await renameProduct("Fast grow standard", "Fastgrow Standard");

  // 12. Fastgrow High P
  console.log("12. Fastgrow High P casing");
  await renameProduct("fastgrow high P", "Fastgrow High P");
  await renameProduct("Fastgrow high P", "Fastgrow High P");

  // 13. Potassium Nitrate
  console.log("13. Potassium Nitrate spelling");
  await renameProduct("Potacium Nitrate", "Potassium Nitrate", {
    activeIngredient: "Foliar fertilizer",
  });
  await renameProduct("Pottasium Nitrate", "Potassium Nitrate", {
    activeIngredient: "Potassium + Nitrogen",
  });

  // 14. Mulch (trucks) → Mulch
  console.log("14. Mulch (trucks) → Mulch");
  await renameProduct("Mulch (trucks)", "Mulch", {
    activeIngredient: "Dry Grass",
  });

  // 15. Manure and Fine Compost: kept as-is
  console.log("15. Manure / Fine Compost: no changes");

  // 16. Delete corrupted row
  console.log("16. Delete corrupted row (id=223)");
  const deleted = await prisma.nutriSop.deleteMany({ where: { id: 223 } });
  console.log(`  Deleted ${deleted.count} corrupted record(s)`);

  // Verification: count unique products after normalisation
  const products = await prisma.nutriSop.findMany({
    select: { products: true },
    distinct: ["products"],
    orderBy: { products: "asc" },
  });
  console.log(`\n=== Done. Unique products: ${products.length} (was 83) ===`);
  products.forEach((p) => console.log(`  ${p.products}`));
}

main().catch(console.error).finally(() => prisma.$disconnect());
