import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET /api/reports/daily-summary?date=2026-01-29
// Auth: x-api-key header must match REPORT_API_KEY env var
export async function GET(request: Request) {
  try {
    const apiKey = request.headers.get("x-api-key");
    if (!apiKey || apiKey !== process.env.REPORT_API_KEY) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get("date");

    // Target date — defaults to today in EAT (UTC+2)
    const now = new Date();
    const eat = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    const targetDate = dateParam ? new Date(dateParam) : eat;
    const dateStr = targetDate.toISOString().split("T")[0];

    // Compute Monday of this week and day-of-week (0=Mon, 6=Sun)
    const dayJs = targetDate.getDay(); // 0=Sun, 1=Mon...
    const dayOffset = dayJs === 0 ? 6 : dayJs - 1;
    const monday = new Date(targetDate);
    monday.setDate(monday.getDate() - dayOffset);
    monday.setHours(0, 0, 0, 0);
    const mondayStr = monday.toISOString().split("T")[0];
    const todayDayOfWeek = dayOffset;

    // ISO week number
    const d = new Date(Date.UTC(monday.getFullYear(), monday.getMonth(), monday.getDate()));
    const dn = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dn);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNumber = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);

    // Fetch base data
    const [phases, laborSops, nutriSops, farms] = await Promise.all([
      prisma.farmPhase.findMany(),
      prisma.laborSop.findMany(),
      prisma.nutriSop.findMany(),
      prisma.farm.findMany(),
    ]);

    const allPhaseIds = phases.map((p) => p.id);
    const weekDate = new Date(mondayStr);

    // Fetch FULL week schedules (all days) so we can count scheduled days per activity
    const [allLaborSchedules, allNutriSchedules, overrides] = await Promise.all([
      allPhaseIds.length > 0
        ? prisma.laborSchedule.findMany({
            where: { farmPhaseId: { in: allPhaseIds }, weekStartDate: weekDate },
          })
        : [],
      allPhaseIds.length > 0
        ? prisma.nutriSchedule.findMany({
            where: { farmPhaseId: { in: allPhaseIds }, weekStartDate: weekDate },
          })
        : [],
      allPhaseIds.length > 0
        ? prisma.phaseActivityOverride.findMany({
            where: { farmPhaseId: { in: allPhaseIds }, weekStart: weekDate },
          })
        : [],
    ]);

    // Build count maps: how many days each activity is scheduled this week
    const laborDayCount = new Map<string, number>();
    allLaborSchedules.forEach((ls) => {
      const key = `${ls.farmPhaseId}-${ls.laborSopId}`;
      laborDayCount.set(key, (laborDayCount.get(key) || 0) + 1);
    });

    const nutriDayCount = new Map<string, number>();
    allNutriSchedules.forEach((ns) => {
      const key = `${ns.farmPhaseId}-${ns.nutriSopId}`;
      nutriDayCount.set(key, (nutriDayCount.get(key) || 0) + 1);
    });

    // Filter to today only
    const todayLaborSet = new Set(
      allLaborSchedules
        .filter((ls) => ls.dayOfWeek === todayDayOfWeek)
        .map((ls) => `${ls.farmPhaseId}-${ls.laborSopId}`)
    );
    const todayNutriSet = new Set(
      allNutriSchedules
        .filter((ns) => ns.dayOfWeek === todayDayOfWeek)
        .map((ns) => `${ns.farmPhaseId}-${ns.nutriSopId}`)
    );

    // Override map
    const overrideMap = new Map<string, string>();
    overrides.forEach((o) => {
      overrideMap.set(`${o.farmPhaseId}-${o.sopId}-${o.sopType}`, o.action);
    });

    // Farm rate map
    const farmRateMap = new Map<string, number>();
    farms.forEach((f) => {
      if (f.laborRatePerDay != null) {
        farmRateMap.set(f.name, Number(f.laborRatePerDay));
      }
    });

    // Group phases by farm
    const farmGroups = new Map<string, typeof phases>();
    phases.forEach((p) => {
      if (!farmGroups.has(p.farm)) farmGroups.set(p.farm, []);
      farmGroups.get(p.farm)!.push(p);
    });

    // Build per-farm summary
    const farmSummaries = Array.from(farmGroups.entries()).map(([farmName, farmPhases]) => {
      const laborTasks: {
        phase: string;
        task: string;
        mandays: number;
        costPerDay: number;
        totalCost: number;
      }[] = [];

      const nutriTasks: {
        phase: string;
        product: string;
        activeIngredient: string;
        quantity: number;
        unitPrice: number;
        totalCost: number;
      }[] = [];

      const farmRate = farmRateMap.get(farmName);

      farmPhases.forEach((phase) => {
        const sowingDate = new Date(phase.sowingDate);
        const diffMs = monday.getTime() - sowingDate.getTime();
        const weeksSinceSowing = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000));
        if (weeksSinceSowing < 0) return;

        const areaHa = Number(phase.areaHa) || 0;

        // --- LABOR ---
        const matchingLaborSops = laborSops.filter(
          (sop) => sop.cropCode === phase.cropCode && sop.week === weeksSinceSowing
        );

        const processLaborSop = (sop: (typeof laborSops)[number]) => {
          const key = `${phase.id}-${sop.id}`;
          if (overrideMap.get(`${key}-labor`) === "remove") return;
          if (!todayLaborSet.has(key)) return;

          const costPerDay = farmRate && farmRate > 0 ? farmRate : Number(sop.costPerCasualDay) || 0;
          const totalMandays = sop.noOfCasuals * sop.noOfDays * areaHa;
          const daysScheduled = laborDayCount.get(key) || 1;
          const mandaysToday = totalMandays / daysScheduled;

          laborTasks.push({
            phase: phase.phaseId,
            task: sop.task,
            mandays: mandaysToday,
            costPerDay,
            totalCost: mandaysToday * costPerDay,
          });
        };

        matchingLaborSops.forEach(processLaborSop);

        // "add" overrides for labor (SOPs from other weeks manually added)
        overrides
          .filter((o) => o.farmPhaseId === phase.id && o.sopType === "labor" && o.action === "add")
          .forEach((o) => {
            const sop = laborSops.find((s) => s.id === o.sopId);
            if (!sop) return;
            if (matchingLaborSops.some((s) => s.id === sop.id)) return;
            processLaborSop(sop);
          });

        // --- NUTRI ---
        const matchingNutriSops = nutriSops.filter(
          (sop) => sop.cropCode === phase.cropCode && sop.week === weeksSinceSowing
        );

        const processNutriSop = (sop: (typeof nutriSops)[number]) => {
          const key = `${phase.id}-${sop.id}`;
          if (overrideMap.get(`${key}-nutri`) === "remove") return;
          if (!todayNutriSet.has(key)) return;

          const rateHa = Number(sop.rateHa) || 0;
          const totalQty = rateHa * areaHa;
          const unitPrice = Number(sop.unitPriceRwf) || 0;
          const costPerHa = Number(sop.cost) || 0;
          const daysScheduled = nutriDayCount.get(key) || 1;

          nutriTasks.push({
            phase: phase.phaseId,
            product: sop.products,
            activeIngredient: sop.activeIngredient,
            quantity: totalQty / daysScheduled,
            unitPrice,
            totalCost: (costPerHa * areaHa) / daysScheduled,
          });
        };

        matchingNutriSops.forEach(processNutriSop);

        // "add" overrides for nutri
        overrides
          .filter((o) => o.farmPhaseId === phase.id && o.sopType === "nutri" && o.action === "add")
          .forEach((o) => {
            const sop = nutriSops.find((s) => s.id === o.sopId);
            if (!sop) return;
            if (matchingNutriSops.some((s) => s.id === sop.id)) return;
            processNutriSop(sop);
          });
      });

      return {
        farm: farmName,
        totalAcreage: farmPhases.reduce((s, p) => s + (Number(p.areaHa) || 0), 0),
        phaseCount: farmPhases.length,
        laborTasks,
        nutriTasks,
        totalLaborMandays: laborTasks.reduce((s, t) => s + t.mandays, 0),
        totalLaborCost: laborTasks.reduce((s, t) => s + t.totalCost, 0),
        totalNutriCost: nutriTasks.reduce((s, t) => s + t.totalCost, 0),
      };
    });

    const activeFarms = farmSummaries.filter(
      (f) => f.laborTasks.length > 0 || f.nutriTasks.length > 0
    );

    return NextResponse.json({
      date: dateStr,
      dayName: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"][todayDayOfWeek],
      weekNumber,
      weekStart: mondayStr,
      farms: activeFarms,
      totals: {
        laborMandays: activeFarms.reduce((s, f) => s + f.totalLaborMandays, 0),
        laborCost: activeFarms.reduce((s, f) => s + f.totalLaborCost, 0),
        nutriCost: activeFarms.reduce((s, f) => s + f.totalNutriCost, 0),
      },
    });
  } catch (error) {
    console.error("Failed to generate daily summary:", error);
    return NextResponse.json({ error: "Failed to generate summary" }, { status: 500 });
  }
}
