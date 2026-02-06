// Quick diagnostic to check harvest_logs and harvest_schedules data
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkData() {
  try {
    console.log('=== HARVEST LOGS ===');
    const logs = await prisma.harvestLog.findMany({
      orderBy: { logDate: 'desc' },
      take: 10,
    });
    console.log(`Total logs in DB: ${logs.length}`);
    logs.forEach(log => {
      console.log(`  ID ${log.id}: Phase ${log.farmPhaseId}, Date ${log.logDate.toISOString().split('T')[0]}, Grade1: ${log.grade1Kg}, Grade2: ${log.grade2Kg}, Total: ${log.actualKg}`);
    });

    console.log('\n=== HARVEST SCHEDULES (PLEDGES) ===');
    const schedules = await prisma.harvestSchedule.findMany({
      orderBy: { weekStartDate: 'desc' },
      take: 10,
    });
    console.log(`Total schedules in DB: ${schedules.length}`);
    schedules.forEach(sched => {
      console.log(`  ID ${sched.id}: Phase ${sched.farmPhaseId}, Week ${sched.weekStartDate.toISOString().split('T')[0]}, Day ${sched.dayOfWeek}, Pledge: ${sched.pledgeKg}`);
    });

    console.log('\n=== TESTING PERFORMANCE API QUERY ===');
    const weekStart = '2026-02-03';
    const anchorMonday = new Date(weekStart + 'T00:00:00.000Z');
    const lookbackWeeks = 1;

    const includedWeeks = [];
    for (let i = 0; i < lookbackWeeks; i++) {
      const monday = new Date(anchorMonday);
      monday.setUTCDate(monday.getUTCDate() - (i * 7));
      includedWeeks.push(monday);
    }
    includedWeeks.reverse();

    const startDate = includedWeeks[0];
    const endDate = new Date(anchorMonday);
    endDate.setUTCDate(endDate.getUTCDate() + 6);
    endDate.setUTCHours(23, 59, 59, 999);

    console.log(`Query params: weekStart=${weekStart}, lookbackWeeks=${lookbackWeeks}`);
    console.log(`Included weeks:`, includedWeeks.map(w => w.toISOString().split('T')[0]));
    console.log(`Date range: ${startDate.toISOString()} to ${endDate.toISOString()}`);

    const queriedSchedules = await prisma.harvestSchedule.findMany({
      where: { weekStartDate: { in: includedWeeks } },
    });
    console.log(`\nSchedules found by query: ${queriedSchedules.length}`);

    const queriedLogs = await prisma.harvestLog.findMany({
      where: {
        logDate: { gte: startDate, lte: endDate },
      },
    });
    console.log(`Logs found by query: ${queriedLogs.length}`);
    queriedLogs.forEach(log => {
      console.log(`  ID ${log.id}: Phase ${log.farmPhaseId}, Date ${log.logDate.toISOString().split('T')[0]}, actualKg: ${log.actualKg}`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkData();
