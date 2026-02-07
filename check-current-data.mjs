// Check current harvest data status
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkData() {
  try {
    console.log('=== CHECKING CURRENT DATA ===\n');

    // Check harvest_schedules
    const schedules = await prisma.harvestSchedule.findMany({
      orderBy: { weekStartDate: 'desc' },
      take: 5,
    });
    console.log(`harvest_schedules: ${schedules.length > 0 ? schedules.length + ' records found' : 'EMPTY'}`);
    if (schedules.length > 0) {
      console.log('Sample:');
      schedules.slice(0, 3).forEach(s => {
        console.log(`  Phase ${s.farmPhaseId}, Week ${s.weekStartDate.toISOString().split('T')[0]}, Day ${s.dayOfWeek}, Pledge: ${s.pledgeKg} kg`);
      });
    }

    console.log('');

    // Check harvest_logs
    const logs = await prisma.harvestLog.findMany({
      orderBy: { logDate: 'desc' },
      take: 5,
    });
    console.log(`harvest_logs: ${logs.length > 0 ? logs.length + ' records found' : 'EMPTY'}`);
    if (logs.length > 0) {
      console.log('Sample:');
      logs.slice(0, 3).forEach(l => {
        console.log(`  Phase ${l.farmPhaseId}, Date ${l.logDate.toISOString().split('T')[0]}, Actual: ${l.actualKg} kg (G1: ${l.grade1Kg}, G2: ${l.grade2Kg})`);
      });
    }

    console.log('\n=== DONE ===');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkData();
