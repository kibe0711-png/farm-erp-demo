import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const p = new PrismaClient({ adapter });

async function main() {
  // Check columns on harvest_schedules
  const cols: { column_name: string }[] = await p.$queryRawUnsafe(
    "SELECT column_name FROM information_schema.columns WHERE table_name = 'harvest_schedules' ORDER BY ordinal_position"
  );
  console.log("harvest_schedules columns:", cols.map((c) => c.column_name));

  // Count pledges
  const count = await p.harvestSchedule.count();
  console.log("Total pledge entries:", count);

  // Sample data
  const sample = await p.harvestSchedule.findMany({ take: 5 });
  console.log("Sample:", JSON.stringify(sample, null, 2));

  // Test the exact query the UI uses — week 6 (Feb 2)
  const weekStart = "2026-02-02";
  const queryDate = new Date(weekStart + "T00:00:00.000Z");
  const nextDay = new Date(queryDate);
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);

  const allIds = await p.farmPhase.findMany({ select: { id: true } });
  const ids = allIds.map((r) => r.id);

  const pledges = await p.harvestSchedule.findMany({
    where: {
      farmPhaseId: { in: ids },
      weekStartDate: { gte: queryDate, lt: nextDay },
    },
  });
  console.log(`\nPledges for week ${weekStart}: ${pledges.length} entries`);
  if (pledges.length > 0) {
    console.log("First 5:", JSON.stringify(pledges.slice(0, 5), null, 2));
  }
}

main().catch(console.error).finally(() => p.$disconnect());
