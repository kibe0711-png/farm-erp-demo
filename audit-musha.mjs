import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("=== MUSHA FARM AUDIT ===\n");

  // 1. Find all Musha farm phases
  console.log("1. FarmPhase records for Musha:");
  const phases = await prisma.farmPhase.findMany({
    where: { farm: "Musha" },
    orderBy: { phaseId: 'asc' }
  });
  console.log(`Found ${phases.length} phases`);
  phases.forEach(p => {
    console.log(`  - ID: ${p.id}, PhaseId: ${p.phaseId}, CropCode: ${p.cropCode}, SowingDate: ${p.sowingDate.toISOString().split('T')[0]}, Area: ${p.areaHa}ha`);
  });

  if (phases.length === 0) {
    console.log("\n❌ NO MUSHA PHASES FOUND - This is the problem!");
    return;
  }

  const phaseIds = phases.map(p => p.id);

  // 2. Check harvest logs
  console.log("\n2. HarvestLog records for Musha phases:");
  const harvestLogs = await prisma.harvestLog.findMany({
    where: { farmPhaseId: { in: phaseIds } },
    orderBy: { logDate: 'asc' }
  });
  console.log(`Found ${harvestLogs.length} harvest logs`);

  let totalActualKg = 0;
  let totalGrade1Kg = 0;
  let totalGrade2Kg = 0;

  harvestLogs.forEach(log => {
    const actualKg = parseFloat(String(log.actualKg)) || 0;
    const grade1Kg = parseFloat(String(log.grade1Kg)) || 0;
    const grade2Kg = parseFloat(String(log.grade2Kg)) || 0;

    totalActualKg += actualKg;
    totalGrade1Kg += grade1Kg;
    totalGrade2Kg += grade2Kg;

    console.log(`  - PhaseId: ${log.farmPhaseId}, Date: ${log.logDate.toISOString().split('T')[0]}, Actual: ${actualKg}kg, Grade1: ${grade1Kg}kg, Grade2: ${grade2Kg}kg`);
  });

  console.log(`\n  Total Actual: ${totalActualKg}kg (${(totalActualKg/1000).toFixed(2)}T)`);
  console.log(`  Total Grade1: ${totalGrade1Kg}kg (${(totalGrade1Kg/1000).toFixed(2)}T)`);
  console.log(`  Total Grade2: ${totalGrade2Kg}kg (${(totalGrade2Kg/1000).toFixed(2)}T)`);

  // 3. Check harvest schedules (pledges)
  console.log("\n3. HarvestSchedule (pledges) for Musha phases:");
  const harvestSchedules = await prisma.harvestSchedule.findMany({
    where: { farmPhaseId: { in: phaseIds } },
    orderBy: { weekStartDate: 'asc' }
  });
  console.log(`Found ${harvestSchedules.length} harvest schedules`);

  let totalPledgeKg = 0;
  harvestSchedules.forEach(sched => {
    const pledgeKg = parseFloat(String(sched.pledgeKg)) || 0;
    totalPledgeKg += pledgeKg;
    console.log(`  - PhaseId: ${sched.farmPhaseId}, WeekStart: ${sched.weekStartDate.toISOString().split('T')[0]}, Day: ${sched.dayOfWeek}, Pledge: ${pledgeKg}kg`);
  });

  console.log(`\n  Total Pledge: ${totalPledgeKg}kg (${(totalPledgeKg/1000).toFixed(2)}T)`);

  // 4. Check date filtering for "Last 3 Weeks"
  console.log("\n4. Date Range Test (Last 3 Weeks logic):");
  const today = new Date();
  const dayOfWeek = today.getDay();
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const currentMonday = new Date(today);
  currentMonday.setDate(today.getDate() - daysFromMonday);
  currentMonday.setHours(0, 0, 0, 0);

  const lastSunday = new Date(currentMonday);
  lastSunday.setDate(currentMonday.getDate() - 1);
  lastSunday.setHours(23, 59, 59, 999);

  const startDate = new Date(lastSunday);
  startDate.setDate(lastSunday.getDate() - (3 * 7) + 1);
  startDate.setHours(0, 0, 0, 0);

  console.log(`  Today: ${today.toISOString().split('T')[0]}`);
  console.log(`  Current Monday: ${currentMonday.toISOString().split('T')[0]}`);
  console.log(`  Last Sunday: ${lastSunday.toISOString().split('T')[0]}`);
  console.log(`  Start Date (3 weeks back): ${startDate.toISOString().split('T')[0]}`);
  console.log(`  Date Range: ${startDate.toISOString().split('T')[0]} to ${lastSunday.toISOString().split('T')[0]}`);

  // 5. Filter harvest logs within this date range
  console.log("\n5. Harvest Logs within Last 3 Weeks range:");
  const filteredLogs = harvestLogs.filter(log => {
    const logDate = new Date(log.logDate);
    return logDate >= startDate && logDate <= lastSunday;
  });
  console.log(`  ${filteredLogs.length} out of ${harvestLogs.length} logs fall within the date range`);

  let filteredActualKg = 0;
  filteredLogs.forEach(log => {
    const actualKg = parseFloat(String(log.actualKg)) || 0;
    filteredActualKg += actualKg;
    console.log(`    - Date: ${log.logDate.toISOString().split('T')[0]}, Actual: ${actualKg}kg`);
  });
  console.log(`  Total in range: ${filteredActualKg}kg (${(filteredActualKg/1000).toFixed(2)}T)`);

  // 6. Check if logs are outside the 3-week window
  if (filteredLogs.length === 0 && harvestLogs.length > 0) {
    console.log("\n⚠️ ALL HARVEST LOGS ARE OUTSIDE THE 3-WEEK DATE RANGE!");
    console.log("   This explains why Performance tab shows zero.");
    console.log("\n   Earliest log: " + harvestLogs[0].logDate.toISOString().split('T')[0]);
    console.log("   Latest log: " + harvestLogs[harvestLogs.length - 1].logDate.toISOString().split('T')[0]);
  }
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
