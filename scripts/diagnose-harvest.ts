import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const p = new PrismaClient({ adapter });

async function main() {
  const phases = await p.farmPhase.findMany();
  const phaseMap = new Map(phases.map((ph) => [ph.id, ph]));

  // Fetch ALL logs (like the app does)
  const allLogs = await p.harvestLog.findMany();
  console.log(`Total harvest logs in DB: ${allLogs.length}`);
  console.log(`Total phases in DB: ${phases.length}`);

  const mulPhases = phases.filter((ph) => ph.farm === "Mulindi");
  const mulPhaseIds = new Set(mulPhases.map((ph) => ph.id));
  console.log(`Mulindi phases: ${mulPhases.length}, IDs: ${[...mulPhaseIds].join(",")}`);

  // Simulate farm card date filter (week 6: Feb 2-8)
  const selectedMonday = new Date(2026, 1, 2); // local midnight
  const weekEnd = new Date(2026, 1, 8, 23, 59, 59, 999);

  console.log(`\nselectedMonday: ${selectedMonday.toISOString()}`);
  console.log(`weekEnd: ${weekEnd.toISOString()}`);

  // Farm card logic
  const cardLogs = allLogs.filter((log) => {
    if (!mulPhaseIds.has(log.farmPhaseId)) return false;
    const d = new Date(log.logDate as unknown as string);
    return d >= selectedMonday && d <= weekEnd;
  });

  const cardTotal = cardLogs.reduce((sum, log) => sum + Number(log.actualKg), 0);
  console.log(`\n=== Farm Card Result ===`);
  console.log(`Mulindi card: ${cardLogs.length} logs, ${cardTotal.toFixed(1)} kg`);

  // Show each log
  for (const log of cardLogs) {
    const phase = phaseMap.get(log.farmPhaseId);
    const d = new Date(log.logDate as unknown as string);
    console.log(`  id=${log.id} phase=${phase?.phaseId || "?"} date=${d.toISOString().split("T")[0]} actual=${Number(log.actualKg)} g1=${Number(log.grade1Kg)} g2=${Number(log.grade2Kg)}`);
  }

  // Now simulate the expanded view (farmHarvestLogs)
  const expandedLogs = allLogs.filter((log) => {
    if (!mulPhaseIds.has(log.farmPhaseId)) return false;
    const d = new Date(log.logDate as unknown as string);
    return d >= selectedMonday && d <= weekEnd;
  });
  const expandedTotal = expandedLogs.reduce((sum, log) => sum + Number(log.actualKg), 0);
  console.log(`\n=== Expanded View Result ===`);
  console.log(`Mulindi expanded: ${expandedLogs.length} logs, ${expandedTotal.toFixed(1)} kg`);

  // Check for duplicate log IDs
  const idCounts = new Map<number, number>();
  for (const log of cardLogs) {
    idCounts.set(log.id, (idCounts.get(log.id) || 0) + 1);
  }
  const dupIds = [...idCounts.entries()].filter(([, c]) => c > 1);
  if (dupIds.length > 0) {
    console.log(`\nDUPLICATE LOG IDs in results: ${dupIds.map(([id, c]) => `${id}x${c}`).join(", ")}`);
  }

  // Check raw logDate values to understand timezone
  console.log(`\n=== Raw logDate samples ===`);
  const samples = allLogs.filter((l) => mulPhaseIds.has(l.farmPhaseId)).slice(0, 10);
  for (const l of samples) {
    console.log(`  id=${l.id} raw=${JSON.stringify(l.logDate)} type=${typeof l.logDate} parsed=${new Date(l.logDate as unknown as string).toISOString()}`);
  }
}

main().catch(console.error).finally(() => p.$disconnect());
