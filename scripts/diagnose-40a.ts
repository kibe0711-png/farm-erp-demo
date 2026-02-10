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
  // 1. Find phase 40a on Mulindi
  const phase = await prisma.farmPhase.findFirst({
    where: { phaseId: "Phase 40 a", farm: "Mulindi" },
  });

  if (!phase) {
    // Try broader search
    const phases = await prisma.farmPhase.findMany({
      where: { phaseId: { contains: "40" }, farm: "Mulindi" },
      select: { id: true, phaseId: true, cropCode: true, farm: true, sowingDate: true },
    });
    console.log("No exact match for 40a Mulindi. Phases containing '40':", phases);
    return;
  }

  console.log("=== PHASE INFO ===");
  console.log(`  ID: ${phase.id}, phaseId: ${phase.phaseId}, crop: ${phase.cropCode}, farm: ${phase.farm}`);
  console.log(`  sowingDate: ${phase.sowingDate.toISOString()}`);

  // 2. Get current week's Monday (EAT)
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Sun
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  const weekEnd = new Date(monday);
  weekEnd.setDate(monday.getDate() + 7);

  console.log(`\n=== CURRENT WEEK: ${monday.toISOString().split("T")[0]} to ${weekEnd.toISOString().split("T")[0]} ===`);

  // 3. Check attendance records for this phase this week
  const attendance = await prisma.attendanceRecord.findMany({
    where: {
      farmPhaseId: phase.id,
      date: { gte: monday, lt: weekEnd },
    },
    include: { casualWorker: { select: { name: true } } },
    orderBy: { date: "asc" },
  });

  console.log(`\n=== ATTENDANCE RECORDS (${attendance.length}) ===`);
  for (const rec of attendance) {
    const recDate = new Date(rec.date);
    const dow = (recDate.getUTCDay() + 6) % 7;
    const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    console.log(`  ${rec.date.toISOString().split("T")[0]} (${dayNames[dow]}) — activity: "${rec.activity}", worker: ${rec.casualWorker.name}`);
  }

  // 5. Check labor schedules for this phase this week
  const schedules = await prisma.laborSchedule.findMany({
    where: {
      farmPhaseId: phase.id,
      weekStartDate: monday,
    },
    orderBy: { dayOfWeek: "asc" },
  });

  console.log(`\n=== LABOR SCHEDULES (${schedules.length}) ===`);
  const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  for (const sched of schedules) {
    const sop = await prisma.laborSop.findUnique({ where: { id: sched.laborSopId } });
    console.log(`  Day ${sched.dayOfWeek} (${dayNames[sched.dayOfWeek]}) — sopId: ${sched.laborSopId}, task: "${sop?.task || "???"}"`)
  }

}

main().catch(console.error).finally(() => prisma.$disconnect());
