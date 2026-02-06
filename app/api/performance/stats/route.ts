import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth/getAuthUser";

interface PhasePerformance {
  phaseId: string;
  cropCode: string;
  areaHa: number;
  sowingDate: string;
  totalHarvestKg: number;
  totalPledgeKg: number;
  pledgeVariance: number;
  grade1Kg: number;
  grade2Kg: number;
  rejectKg: number;
  rejectRate: number;
  yieldPerHa: number;
}

interface FarmPerformance {
  farm: string;
  phaseCount: number;
  totalAreaHa: number;
  totalHarvestKg: number;
  totalPledgeKg: number;
  avgPledgeVariance: number;
  totalGrade1Kg: number;
  totalGrade2Kg: number;
  totalRejectKg: number;
  avgRejectRate: number;
  avgYieldPerHa: number;
  phases: PhasePerformance[];
}

/**
 * GET /api/performance/stats
 * Returns aggregated performance metrics by farm and phase
 * Query params:
 *   - weeks: 0 (this week) | 1 | 3 | 8 (default: 3)
 */
export async function GET(request: Request) {
  try {
    // Auth check
    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse date range from query params
    const { searchParams } = new URL(request.url);
    const weeksParam = searchParams.get("weeks") || "3";
    const weeks = parseInt(weeksParam);

    if (![0, 1, 3, 8].includes(weeks)) {
      return NextResponse.json({ error: "Invalid weeks parameter. Must be 0, 1, 3, or 8." }, { status: 400 });
    }

    // Calculate Monday-based week date range
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat

    // Find Monday of current week (0=Sun, so Mon=1)
    const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const currentMonday = new Date(today);
    currentMonday.setDate(today.getDate() - daysFromMonday);
    currentMonday.setHours(0, 0, 0, 0);

    let startDate: Date;
    let endDate: Date;

    if (weeks === 0) {
      // This Week: Monday of current week to today
      startDate = new Date(currentMonday);
      endDate = new Date(today);
      endDate.setHours(23, 59, 59, 999);
    } else {
      // Last N complete weeks: N weeks back to last Sunday
      // Find last Sunday (end of last complete week)
      const lastSunday = new Date(currentMonday);
      lastSunday.setDate(currentMonday.getDate() - 1); // Go back 1 day from Monday = Sunday
      lastSunday.setHours(23, 59, 59, 999);

      // Start date: N weeks back from last Sunday's week
      startDate = new Date(lastSunday);
      startDate.setDate(lastSunday.getDate() - (weeks * 7) + 1); // +1 to get Monday
      startDate.setHours(0, 0, 0, 0);

      endDate = lastSunday;
    }

    // Fetch all phases
    const phases = await prisma.farmPhase.findMany({
      orderBy: [{ farm: "asc" }, { phaseId: "asc" }],
    });

    // Fetch harvest logs within date range (no labor logs needed)
    const harvestLogs = await prisma.harvestLog.findMany({
      where: {
        logDate: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    // Fetch harvest schedules (pledges) within date range
    const harvestSchedules = await prisma.harvestSchedule.findMany({
      where: {
        weekStartDate: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    // Group harvest logs by farmPhaseId for easy lookup
    const harvestLogsByPhase = new Map<number, typeof harvestLogs>();

    for (const log of harvestLogs) {
      const phaseId = log.farmPhaseId;
      if (!harvestLogsByPhase.has(phaseId)) {
        harvestLogsByPhase.set(phaseId, []);
      }
      harvestLogsByPhase.get(phaseId)!.push(log);
    }

    // Group harvest schedules (pledges) by farmPhaseId for easy lookup
    const pledgesByPhase = new Map<number, typeof harvestSchedules>();

    for (const schedule of harvestSchedules) {
      const phaseId = schedule.farmPhaseId;
      if (!pledgesByPhase.has(phaseId)) {
        pledgesByPhase.set(phaseId, []);
      }
      pledgesByPhase.get(phaseId)!.push(schedule);
    }

    // Group phases by farm and calculate metrics
    const farmMap = new Map<string, PhasePerformance[]>();

    for (const phase of phases) {
      const phaseHarvestLogs = harvestLogsByPhase.get(phase.id) || [];
      const phasePledges = pledgesByPhase.get(phase.id) || [];

      // Calculate harvest metrics
      const totalHarvestKg = phaseHarvestLogs.reduce((sum, log) => {
        const kg = parseFloat(String(log.actualKg)) || 0;
        return sum + kg;
      }, 0);

      const grade1Kg = phaseHarvestLogs.reduce((sum, log) => {
        const kg = parseFloat(String(log.grade1Kg)) || 0;
        return sum + kg;
      }, 0);

      const grade2Kg = phaseHarvestLogs.reduce((sum, log) => {
        const kg = parseFloat(String(log.grade2Kg)) || 0;
        return sum + kg;
      }, 0);

      // Calculate pledge total
      const totalPledgeKg = phasePledges.reduce((sum, schedule) => {
        const kg = parseFloat(String(schedule.pledgeKg)) || 0;
        return sum + kg;
      }, 0);

      // Calculate pledge variance: (actual - pledged) / pledged * 100
      const pledgeVariance = totalPledgeKg > 0 ? ((totalHarvestKg - totalPledgeKg) / totalPledgeKg) * 100 : 0;

      // Grade 2 ARE the rejects (only 2 categories: Grade 1 + Grade 2)
      const rejectKg = grade2Kg;
      const rejectRate = totalHarvestKg > 0 ? (rejectKg / totalHarvestKg) * 100 : 0;

      const totalHarvestTons = totalHarvestKg / 1000;
      const areaHa = parseFloat(String(phase.areaHa)) || 0;
      const yieldPerHa = areaHa > 0 ? totalHarvestTons / areaHa : 0;

      const phasePerf: PhasePerformance = {
        phaseId: phase.phaseId,
        cropCode: phase.cropCode,
        areaHa,
        sowingDate: phase.sowingDate.toISOString().split("T")[0],
        totalHarvestKg,
        totalPledgeKg,
        pledgeVariance,
        grade1Kg,
        grade2Kg,
        rejectKg,
        rejectRate,
        yieldPerHa,
      };

      if (!farmMap.has(phase.farm)) {
        farmMap.set(phase.farm, []);
      }
      farmMap.get(phase.farm)!.push(phasePerf);
    }

    // Calculate farm-level aggregates
    const farms: FarmPerformance[] = [];

    for (const [farmName, phasePerfs] of farmMap) {
      const totalAreaHa = phasePerfs.reduce((sum, p) => sum + p.areaHa, 0);
      const totalHarvestKg = phasePerfs.reduce((sum, p) => sum + p.totalHarvestKg, 0);
      const totalPledgeKg = phasePerfs.reduce((sum, p) => sum + p.totalPledgeKg, 0);
      const totalGrade1Kg = phasePerfs.reduce((sum, p) => sum + p.grade1Kg, 0);
      const totalGrade2Kg = phasePerfs.reduce((sum, p) => sum + p.grade2Kg, 0);
      const totalRejectKg = phasePerfs.reduce((sum, p) => sum + p.rejectKg, 0);

      // Weighted average pledge variance (by pledge volume)
      const avgPledgeVariance = totalPledgeKg > 0 ? ((totalHarvestKg - totalPledgeKg) / totalPledgeKg) * 100 : 0;

      // Weighted average reject rate (by harvest volume)
      const avgRejectRate = totalHarvestKg > 0 ? (totalRejectKg / totalHarvestKg) * 100 : 0;

      const totalHarvestTons = totalHarvestKg / 1000;
      const avgYieldPerHa = totalAreaHa > 0 ? totalHarvestTons / totalAreaHa : 0;

      farms.push({
        farm: farmName,
        phaseCount: phasePerfs.length,
        totalAreaHa,
        totalHarvestKg,
        totalPledgeKg,
        avgPledgeVariance,
        totalGrade1Kg,
        totalGrade2Kg,
        totalRejectKg,
        avgRejectRate,
        avgYieldPerHa,
        phases: phasePerfs,
      });
    }

    // Sort farms alphabetically
    farms.sort((a, b) => a.farm.localeCompare(b.farm));

    return NextResponse.json({
      farms,
      dateRange: {
        startDate: startDate.toISOString().split("T")[0],
        endDate: endDate.toISOString().split("T")[0],
        weeks,
        isThisWeek: weeks === 0,
      },
    });
  } catch (error) {
    console.error("Failed to fetch performance stats:", error);
    return NextResponse.json({ error: "Failed to fetch performance data" }, { status: 500 });
  }
}
