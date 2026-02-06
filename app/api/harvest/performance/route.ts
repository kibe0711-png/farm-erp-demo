import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth/getAuthUser";

interface WeekBreakdown {
  weekStartDate: string;
  pledgeKg: number;
  actualKg: number;
  variance: number;
}

interface PhasePerformance {
  farmPhaseId: number;
  phaseId: string;
  cropCode: string;
  farm: string;
  areaHa: number;
  totalPledgeKg: number;
  totalActualKg: number;
  variance: number;
  fulfillmentRate: number;
  daysHarvested: number;
  weeklyBreakdown: WeekBreakdown[];
}

/**
 * GET /api/harvest/performance
 * Returns harvest performance metrics (pledges vs actuals) aggregated by phase
 * Query params:
 *   - weekStartDate: YYYY-MM-DD (anchor Monday)
 *   - lookbackWeeks: 1-12 (default: 1)
 */
export async function GET(request: Request) {
  try {
    // Auth check
    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse query params
    const { searchParams } = new URL(request.url);
    const weekStart = searchParams.get("weekStartDate");
    const lookbackParam = searchParams.get("lookbackWeeks") || "1";

    if (!weekStart) {
      return NextResponse.json(
        { error: "weekStartDate is required" },
        { status: 400 }
      );
    }

    // Parse and validate inputs
    const anchorMonday = new Date(weekStart + "T00:00:00.000Z");
    const lookbackWeeks = Math.min(12, Math.max(1, parseInt(lookbackParam)));

    // Calculate included weeks array (N complete weeks back from anchor)
    const includedWeeks: Date[] = [];
    for (let i = 0; i < lookbackWeeks; i++) {
      const monday = new Date(anchorMonday);
      monday.setUTCDate(monday.getUTCDate() - i * 7);
      includedWeeks.push(monday);
    }
    includedWeeks.reverse(); // Oldest to newest

    // Calculate date range for harvest_logs (earliest Monday to latest Sunday)
    const startDate = includedWeeks[0];
    const endDate = new Date(anchorMonday);
    endDate.setUTCDate(endDate.getUTCDate() + 6); // Sunday of anchor week
    endDate.setUTCHours(23, 59, 59, 999);

    // Fetch pledges, actuals, and phases in parallel
    const [schedules, logs, phases] = await Promise.all([
      // Pledges from harvest_schedules
      prisma.harvestSchedule.findMany({
        where: { weekStartDate: { in: includedWeeks } },
        orderBy: [{ farmPhaseId: "asc" }, { weekStartDate: "asc" }],
      }),

      // Actuals from harvest_logs (date range: Mon to Sun of all weeks)
      prisma.harvestLog.findMany({
        where: {
          logDate: { gte: startDate, lte: endDate },
        },
        orderBy: [{ farmPhaseId: "asc" }, { logDate: "asc" }],
      }),

      // All phases (will filter after aggregation)
      prisma.farmPhase.findMany({
        select: {
          id: true,
          phaseId: true,
          cropCode: true,
          farm: true,
          areaHa: true,
        },
      }),
    ]);

    // Aggregate pledges by phase and week
    const pledgeMap = new Map<number, Map<string, number>>(); // phaseId -> weekKey -> kg

    for (const schedule of schedules) {
      const phaseId = schedule.farmPhaseId;
      const weekKey = schedule.weekStartDate.toISOString().split("T")[0];
      const pledgeKg = parseFloat(String(schedule.pledgeKg)) || 0;

      if (!pledgeMap.has(phaseId)) {
        pledgeMap.set(phaseId, new Map());
      }

      const weekMap = pledgeMap.get(phaseId)!;
      weekMap.set(weekKey, (weekMap.get(weekKey) || 0) + pledgeKg);
    }

    // Aggregate actuals by phase and week
    const actualMap = new Map<number, Map<string, number>>(); // phaseId -> weekKey -> kg
    const daysHarvestedMap = new Map<number, Set<string>>(); // phaseId -> Set<logDate>

    for (const log of logs) {
      const phaseId = log.farmPhaseId;
      const logDate = new Date(log.logDate);

      // Find which week this log belongs to (Monday anchor)
      const dayOfWeek = (logDate.getUTCDay() + 6) % 7; // Convert Sun=0 to Mon=0
      const monday = new Date(logDate);
      monday.setUTCDate(monday.getUTCDate() - dayOfWeek);
      const weekKey = monday.toISOString().split("T")[0];

      // Only include if this week is in our included weeks
      const includedWeeksStrings = includedWeeks.map((w) =>
        w.toISOString().split("T")[0]
      );
      if (!includedWeeksStrings.includes(weekKey)) {
        continue;
      }

      const actualKg = parseFloat(String(log.actualKg)) || 0;

      if (!actualMap.has(phaseId)) {
        actualMap.set(phaseId, new Map());
        daysHarvestedMap.set(phaseId, new Set());
      }

      const weekMap = actualMap.get(phaseId)!;
      weekMap.set(weekKey, (weekMap.get(weekKey) || 0) + actualKg);

      const daysSet = daysHarvestedMap.get(phaseId)!;
      daysSet.add(log.logDate.toISOString().split("T")[0]);
    }

    // Combine pledges and actuals, format response
    const allPhaseIds = new Set([...pledgeMap.keys(), ...actualMap.keys()]);
    const relevantPhases = phases.filter((p) => allPhaseIds.has(p.id));

    const result: PhasePerformance[] = relevantPhases.map((phase) => {
      const pledgeWeekly = pledgeMap.get(phase.id) || new Map();
      const actualWeekly = actualMap.get(phase.id) || new Map();
      const daysSet = daysHarvestedMap.get(phase.id) || new Set();

      // Calculate totals
      const totalPledgeKg = Array.from(pledgeWeekly.values()).reduce(
        (sum, kg) => sum + kg,
        0
      );
      const totalActualKg = Array.from(actualWeekly.values()).reduce(
        (sum, kg) => sum + kg,
        0
      );
      const variance =
        totalPledgeKg > 0
          ? ((totalActualKg - totalPledgeKg) / totalPledgeKg) * 100
          : 0;
      const fulfillmentRate =
        totalPledgeKg > 0 ? (totalActualKg / totalPledgeKg) * 100 : 0;

      // Build weekly breakdown
      const weeklyBreakdown: WeekBreakdown[] = includedWeeks.map((monday) => {
        const weekKey = monday.toISOString().split("T")[0];
        const pledgeKg = pledgeWeekly.get(weekKey) || 0;
        const actualKg = actualWeekly.get(weekKey) || 0;
        const weekVariance =
          pledgeKg > 0 ? ((actualKg - pledgeKg) / pledgeKg) * 100 : 0;

        return {
          weekStartDate: weekKey,
          pledgeKg,
          actualKg,
          variance: weekVariance,
        };
      });

      return {
        farmPhaseId: phase.id,
        phaseId: phase.phaseId,
        cropCode: phase.cropCode,
        farm: phase.farm,
        areaHa: parseFloat(String(phase.areaHa)),
        totalPledgeKg,
        totalActualKg,
        variance,
        fulfillmentRate,
        daysHarvested: daysSet.size,
        weeklyBreakdown,
      };
    });

    // Calculate grand totals
    const totals = {
      pledgeKg: result.reduce((sum, p) => sum + p.totalPledgeKg, 0),
      actualKg: result.reduce((sum, p) => sum + p.totalActualKg, 0),
      variance: 0,
      fulfillmentRate: 0,
    };
    totals.variance =
      totals.pledgeKg > 0
        ? ((totals.actualKg - totals.pledgeKg) / totals.pledgeKg) * 100
        : 0;
    totals.fulfillmentRate =
      totals.pledgeKg > 0 ? (totals.actualKg / totals.pledgeKg) * 100 : 0;

    return NextResponse.json({
      phases: result,
      includedWeeks: includedWeeks.map((w) => w.toISOString().split("T")[0]),
      dateRange: {
        startDate: startDate.toISOString().split("T")[0],
        endDate: endDate.toISOString().split("T")[0],
        weeks: lookbackWeeks,
      },
      totals,
    });
  } catch (error) {
    console.error("Failed to fetch harvest performance:", error);
    return NextResponse.json(
      { error: "Failed to fetch performance data" },
      { status: 500 }
    );
  }
}
