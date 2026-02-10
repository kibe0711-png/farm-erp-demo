import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  // 1. FarmPhase record with id = 92
  console.log("=== FarmPhase (id=92) ===");
  const phase = await prisma.farmPhase.findUnique({ where: { id: 92 } });
  if (phase) {
    console.log(JSON.stringify(phase, (key, val) => typeof val === 'bigint' ? val.toString() : val, 2));
  } else {
    console.log("No FarmPhase found with id=92");
  }

  // 2. LaborSchedule entries
  console.log("\n=== LaborSchedule (farmPhaseId=92) ===");
  const laborSchedules = await prisma.laborSchedule.findMany({
    where: { farmPhaseId: 92 },
    orderBy: [{ weekStartDate: 'asc' }, { dayOfWeek: 'asc' }],
  });
  console.log(`Count: ${laborSchedules.length}`);
  if (laborSchedules.length > 0) {
    console.log(JSON.stringify(laborSchedules, null, 2));
  }

  // 3. NutriSchedule entries
  console.log("\n=== NutriSchedule (farmPhaseId=92) ===");
  const nutriSchedules = await prisma.nutriSchedule.findMany({
    where: { farmPhaseId: 92 },
    orderBy: [{ weekStartDate: 'asc' }, { dayOfWeek: 'asc' }],
  });
  console.log(`Count: ${nutriSchedules.length}`);
  if (nutriSchedules.length > 0) {
    console.log(JSON.stringify(nutriSchedules, null, 2));
  }

  // 4. HarvestSchedule entries
  console.log("\n=== HarvestSchedule (farmPhaseId=92) ===");
  const harvestSchedules = await prisma.harvestSchedule.findMany({
    where: { farmPhaseId: 92 },
    orderBy: [{ weekStartDate: 'asc' }, { dayOfWeek: 'asc' }],
  });
  console.log(`Count: ${harvestSchedules.length}`);
  if (harvestSchedules.length > 0) {
    console.log(JSON.stringify(harvestSchedules, null, 2));
  }

  console.log("\n=== FeedingRecord (farmPhaseId=92) ===");
  const feedingRecords = await prisma.feedingRecord.findMany({ where: { farmPhaseId: 92 } });
  console.log(`Count: ${feedingRecords.length}`);
  if (feedingRecords.length > 0) {
    console.log(JSON.stringify(feedingRecords, null, 2));
  }

  console.log("\n=== HarvestLog (farmPhaseId=92) ===");
  const harvestLogs = await prisma.harvestLog.findMany({ where: { farmPhaseId: 92 } });
  console.log(`Count: ${harvestLogs.length}`);
  if (harvestLogs.length > 0) {
    console.log(JSON.stringify(harvestLogs, null, 2));
  }

  console.log("\n=== PhaseActivityOverride (farmPhaseId=92) ===");
  const overrides = await prisma.phaseActivityOverride.findMany({ where: { farmPhaseId: 92 } });
  console.log(`Count: ${overrides.length}`);
  if (overrides.length > 0) {
    console.log(JSON.stringify(overrides, null, 2));
  }
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
