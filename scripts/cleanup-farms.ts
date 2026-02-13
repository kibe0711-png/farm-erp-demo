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

async function main() {
  // Check what references farm IDs 5 and 6
  const phases5 = await prisma.farmPhase.count({ where: { farmId: 5 } });
  const phases6 = await prisma.farmPhase.count({ where: { farmId: 6 } });
  const users5 = await prisma.user.count({ where: { assignedFarmId: 5 } });
  const users6 = await prisma.user.count({ where: { assignedFarmId: 6 } });
  const casuals5 = await prisma.casualWorker.count({ where: { farmId: 5 } });
  const casuals6 = await prisma.casualWorker.count({ where: { farmId: 6 } });

  console.log("References to Farm ID 5 (GATSIBO):");
  console.log(`  FarmPhases: ${phases5}, Users: ${users5}, CasualWorkers: ${casuals5}`);
  console.log("References to Farm ID 6 (empty):");
  console.log(`  FarmPhases: ${phases6}, Users: ${users6}, CasualWorkers: ${casuals6}`);

  // Re-link casual workers from farmId 5 to farmId 4 (correct Gatsibo)
  if (casuals5 > 0) {
    const updated = await prisma.casualWorker.updateMany({
      where: { farmId: 5 },
      data: { farmId: 4 },
    });
    console.log(`\nRe-linked ${updated.count} casual workers from farmId 5 -> 4`);
  }

  // Now delete farm ID 5 and 6
  // Need to handle any other references first
  if (phases5 > 0) {
    console.log("\nWARNING: Farm 5 has phases, skipping delete");
  } else if (users5 > 0) {
    console.log("\nWARNING: Farm 5 has users, skipping delete");
  } else {
    await prisma.farm.delete({ where: { id: 5 } });
    console.log("\nDeleted Farm ID 5 (GATSIBO)");
  }

  if (phases6 > 0) {
    console.log("WARNING: Farm 6 has phases, skipping delete");
  } else if (users6 > 0) {
    console.log("WARNING: Farm 6 has users, skipping delete");
  } else {
    if (casuals6 > 0) {
      await prisma.casualWorker.deleteMany({ where: { farmId: 6 } });
      console.log(`Deleted ${casuals6} casual workers linked to farm 6`);
    }
    await prisma.farm.delete({ where: { id: 6 } });
    console.log("Deleted Farm ID 6 (empty)");
  }

  // Verify final state
  const farms = await prisma.farm.findMany({ select: { id: true, name: true }, orderBy: { id: "asc" } });
  console.log("\nFinal farms:");
  console.table(farms);

  const counts = await prisma.casualWorker.groupBy({
    by: ["farmId", "farm"],
    _count: true,
  });
  console.log("\nCasual workers per farm:");
  console.table(counts.map(c => ({ farmId: c.farmId, farm: c.farm, count: c._count })));
}

main().catch(console.error).finally(() => prisma.$disconnect());
