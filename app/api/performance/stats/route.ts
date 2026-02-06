import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth/getAuthUser";

interface PhasePerformance {
  phaseId: string;
  cropCode: string;
  areaHa: number;
  sowingDate: string;
  laborCost: number;
  laborDays: number;
  totalHarvestKg: number;
  grade1Kg: number;
  grade2Kg: number;
  rejectKg: number;
  rejectRate: number;
  costPerTon: number;
  yieldPerHa: number;
}

interface FarmPerformance {
  farm: string;
  phaseCount: number;
  totalAreaHa: number;
  totalLaborCost: number;
  totalLaborDays: number;
  totalHarvestKg: number;
  totalGrade1Kg: number;
  totalGrade2Kg: number;
  totalRejectKg: number;
  avgRejectRate: number;
  avgCostPerTon: number;
  avgYieldPerHa: number;
  phases: PhasePerformance[];
}

/**
 * GET /api/performance/stats
 * Returns aggregated performance metrics by farm and phase
 * Query params:
 *   - days: 7 | 30 | 90 (default: 30)
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
    const daysParam = searchParams.get("days") || "30";
    const days = parseInt(daysParam);

    if (![7, 30, 90].includes(days)) {
      return NextResponse.json({ error: "Invalid days parameter. Must be 7, 30, or 90." }, { status: 400 });
    }

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days);

    // Fetch all phases
    const phases = await prisma.farmPhase.findMany({
      orderBy: [{ farm: "asc" }, { phaseId: "asc" }],
    });

    // Fetch labor logs within date range
    const laborLogs = await prisma.laborLog.findMany({
      where: {
        logDate: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    // Fetch harvest logs within date range
    const harvestLogs = await prisma.harvestLog.findMany({
      where: {
        logDate: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    // Group logs by farmPhaseId for easy lookup
    const laborLogsByPhase = new Map<number, typeof laborLogs>();
    const harvestLogsByPhase = new Map<number, typeof harvestLogs>();

    for (const log of laborLogs) {
      const phaseId = log.farmPhaseId;
      if (!laborLogsByPhase.has(phaseId)) {
        laborLogsByPhase.set(phaseId, []);
      }
      laborLogsByPhase.get(phaseId)!.push(log);
    }

    for (const log of harvestLogs) {
      const phaseId = log.farmPhaseId;
      if (!harvestLogsByPhase.has(phaseId)) {
        harvestLogsByPhase.set(phaseId, []);
      }
      harvestLogsByPhase.get(phaseId)!.push(log);
    }

    // Group phases by farm and calculate metrics
    const farmMap = new Map<string, PhasePerformance[]>();

    for (const phase of phases) {
      const phaseLaborLogs = laborLogsByPhase.get(phase.id) || [];
      const phaseHarvestLogs = harvestLogsByPhase.get(phase.id) || [];

      // Calculate labor metrics
      const laborCost = phaseLaborLogs.reduce((sum, log) => {
        const cost = parseFloat(String(log.totalCost)) || 0;
        return sum + cost;
      }, 0);

      const laborDays = phaseLaborLogs.reduce((sum, log) => {
        const casuals = parseInt(String(log.casuals)) || 0;
        return sum + casuals;
      }, 0);

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

      // Grade 2 ARE the rejects (only 2 categories: Grade 1 + Grade 2)
      const rejectKg = grade2Kg;
      const rejectRate = totalHarvestKg > 0 ? (rejectKg / totalHarvestKg) * 100 : 0;

      const totalHarvestTons = totalHarvestKg / 1000;
      const costPerTon = totalHarvestTons > 0 ? laborCost / totalHarvestTons : 0;

      const areaHa = parseFloat(String(phase.areaHa)) || 0;
      const yieldPerHa = areaHa > 0 ? totalHarvestTons / areaHa : 0;

      const phasePerf: PhasePerformance = {
        phaseId: phase.phaseId,
        cropCode: phase.cropCode,
        areaHa,
        sowingDate: phase.sowingDate.toISOString().split("T")[0],
        laborCost,
        laborDays,
        totalHarvestKg,
        grade1Kg,
        grade2Kg,
        rejectKg,
        rejectRate,
        costPerTon,
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
      const totalLaborCost = phasePerfs.reduce((sum, p) => sum + p.laborCost, 0);
      const totalLaborDays = phasePerfs.reduce((sum, p) => sum + p.laborDays, 0);
      const totalHarvestKg = phasePerfs.reduce((sum, p) => sum + p.totalHarvestKg, 0);
      const totalGrade1Kg = phasePerfs.reduce((sum, p) => sum + p.grade1Kg, 0);
      const totalGrade2Kg = phasePerfs.reduce((sum, p) => sum + p.grade2Kg, 0);
      const totalRejectKg = phasePerfs.reduce((sum, p) => sum + p.rejectKg, 0);

      // Weighted average reject rate (by harvest volume)
      const avgRejectRate = totalHarvestKg > 0 ? (totalRejectKg / totalHarvestKg) * 100 : 0;

      const totalHarvestTons = totalHarvestKg / 1000;
      const avgCostPerTon = totalHarvestTons > 0 ? totalLaborCost / totalHarvestTons : 0;
      const avgYieldPerHa = totalAreaHa > 0 ? totalHarvestTons / totalAreaHa : 0;

      farms.push({
        farm: farmName,
        phaseCount: phasePerfs.length,
        totalAreaHa,
        totalLaborCost,
        totalLaborDays,
        totalHarvestKg,
        totalGrade1Kg,
        totalGrade2Kg,
        totalRejectKg,
        avgRejectRate,
        avgCostPerTon,
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
        days,
      },
    });
  } catch (error) {
    console.error("Failed to fetch performance stats:", error);
    return NextResponse.json({ error: "Failed to fetch performance data" }, { status: 500 });
  }
}
