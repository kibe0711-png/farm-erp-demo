import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET ?farmPhaseIds=1,2,3&weekStart=2026-01-26
// Returns all scheduled tasks for the week with their compliance status
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const idsParam = searchParams.get("farmPhaseIds");
    const weekStart = searchParams.get("weekStart");

    if (!idsParam || !weekStart) {
      return NextResponse.json({ error: "farmPhaseIds and weekStart are required" }, { status: 400 });
    }

    const farmPhaseIds = idsParam.split(",").map(Number).filter((n) => !isNaN(n));
    const weekDate = new Date(weekStart);

    // Fetch all data in parallel
    const weekEndDate = new Date(weekDate.getTime() + 7 * 24 * 60 * 60 * 1000);
    const [laborSchedules, nutriSchedules, harvestSchedules, laborLogs, feedingRecords, harvestLogs, laborSops, nutriSops, farmPhases] =
      await Promise.all([
        prisma.laborSchedule.findMany({
          where: { farmPhaseId: { in: farmPhaseIds }, weekStartDate: weekDate },
        }),
        prisma.nutriSchedule.findMany({
          where: { farmPhaseId: { in: farmPhaseIds }, weekStartDate: weekDate },
        }),
        prisma.harvestSchedule.findMany({
          where: { farmPhaseId: { in: farmPhaseIds }, weekStartDate: weekDate },
        }),
        prisma.laborLog.findMany({
          where: {
            farmPhaseId: { in: farmPhaseIds },
            logDate: { gte: weekDate, lt: weekEndDate },
          },
        }),
        prisma.feedingRecord.findMany({
          where: {
            farmPhaseId: { in: farmPhaseIds },
            applicationDate: { gte: weekDate, lt: weekEndDate },
          },
        }),
        prisma.harvestLog.findMany({
          where: {
            farmPhaseId: { in: farmPhaseIds },
            logDate: { gte: weekDate, lt: weekEndDate },
          },
        }),
        prisma.laborSop.findMany(),
        prisma.nutriSop.findMany(),
        prisma.farmPhase.findMany({
          where: { id: { in: farmPhaseIds } },
          select: { id: true, phaseId: true, farm: true },
        }),
      ]);

    // Build lookup maps
    const laborSopMap = new Map(laborSops.map((s) => [s.id, s]));
    const nutriSopMap = new Map(nutriSops.map((s) => [s.id, s]));
    const phaseMap = new Map(farmPhases.map((p) => [p.id, p]));

    // Build labor log lookup: farmPhaseId + task + dayOfWeek → true
    const laborLogSet = new Set<string>();
    laborLogs.forEach((log) => {
      const logDate = new Date(log.logDate);
      const dayOfWeek = (logDate.getUTCDay() + 6) % 7; // Convert Sun=0 to Mon=0
      laborLogSet.add(`${log.farmPhaseId}-${log.task}-${dayOfWeek}`);
    });

    // Build feeding log lookup: farmPhaseId + product + dayOfWeek → true
    const feedingLogSet = new Set<string>();
    feedingRecords.forEach((rec) => {
      const recDate = new Date(rec.applicationDate);
      const dayOfWeek = (recDate.getUTCDay() + 6) % 7;
      feedingLogSet.add(`${rec.farmPhaseId}-${rec.product}-${dayOfWeek}`);
    });

    // Build harvest log lookup: farmPhaseId + dayOfWeek → true
    const harvestLogSet = new Set<string>();
    harvestLogs.forEach((log) => {
      const logDate = new Date(log.logDate);
      const dayOfWeek = (logDate.getUTCDay() + 6) % 7;
      harvestLogSet.add(`${log.farmPhaseId}-${dayOfWeek}`);
    });

    // Build compliance entries
    const entries: {
      type: "labor" | "nutri" | "harvest";
      farmPhaseId: number;
      phaseId: string;
      farm: string;
      task: string;
      dayOfWeek: number;
      status: "done" | "missed" | "pending" | "upcoming";
    }[] = [];

    // Today's day of week (Mon=0)
    const now = new Date();
    const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStartTime = weekDate.getTime();

    laborSchedules.forEach((sched) => {
      const sop = laborSopMap.get(sched.laborSopId);
      const phase = phaseMap.get(sched.farmPhaseId);
      if (!sop || !phase) return;

      const scheduledDate = new Date(weekStartTime + sched.dayOfWeek * 24 * 60 * 60 * 1000);
      const hasLog = laborLogSet.has(`${sched.farmPhaseId}-${sop.task}-${sched.dayOfWeek}`);

      let status: "done" | "missed" | "pending" | "upcoming";
      if (hasLog) {
        status = "done";
      } else if (scheduledDate.getTime() < todayDate.getTime()) {
        status = "missed";
      } else if (scheduledDate.getTime() === todayDate.getTime()) {
        status = "pending";
      } else {
        status = "upcoming";
      }

      entries.push({
        type: "labor",
        farmPhaseId: sched.farmPhaseId,
        phaseId: phase.phaseId,
        farm: phase.farm,
        task: sop.task,
        dayOfWeek: sched.dayOfWeek,
        status,
      });
    });

    nutriSchedules.forEach((sched) => {
      const sop = nutriSopMap.get(sched.nutriSopId);
      const phase = phaseMap.get(sched.farmPhaseId);
      if (!sop || !phase) return;

      const scheduledDate = new Date(weekStartTime + sched.dayOfWeek * 24 * 60 * 60 * 1000);
      const hasLog = feedingLogSet.has(`${sched.farmPhaseId}-${sop.products}-${sched.dayOfWeek}`);

      let status: "done" | "missed" | "pending" | "upcoming";
      if (hasLog) {
        status = "done";
      } else if (scheduledDate.getTime() < todayDate.getTime()) {
        status = "missed";
      } else if (scheduledDate.getTime() === todayDate.getTime()) {
        status = "pending";
      } else {
        status = "upcoming";
      }

      entries.push({
        type: "nutri",
        farmPhaseId: sched.farmPhaseId,
        phaseId: phase.phaseId,
        farm: phase.farm,
        task: sop.products,
        dayOfWeek: sched.dayOfWeek,
        status,
      });
    });

    harvestSchedules.forEach((sched) => {
      const phase = phaseMap.get(sched.farmPhaseId);
      if (!phase) return;

      const scheduledDate = new Date(weekStartTime + sched.dayOfWeek * 24 * 60 * 60 * 1000);
      const hasLog = harvestLogSet.has(`${sched.farmPhaseId}-${sched.dayOfWeek}`);

      let status: "done" | "missed" | "pending" | "upcoming";
      if (hasLog) {
        status = "done";
      } else if (scheduledDate.getTime() < todayDate.getTime()) {
        status = "missed";
      } else if (scheduledDate.getTime() === todayDate.getTime()) {
        status = "pending";
      } else {
        status = "upcoming";
      }

      entries.push({
        type: "harvest",
        farmPhaseId: sched.farmPhaseId,
        phaseId: phase.phaseId,
        farm: phase.farm,
        task: "Harvest",
        dayOfWeek: sched.dayOfWeek,
        status,
      });
    });

    // Compute summary
    const total = entries.length;
    const done = entries.filter((e) => e.status === "done").length;
    const missed = entries.filter((e) => e.status === "missed").length;
    const pending = entries.filter((e) => e.status === "pending").length;
    const upcoming = entries.filter((e) => e.status === "upcoming").length;
    const countable = done + missed; // Only past tasks count toward compliance
    const complianceRate = countable > 0 ? Math.round((done / countable) * 100) : null;

    return NextResponse.json({ entries, summary: { total, done, missed, pending, upcoming, complianceRate } });
  } catch (error) {
    console.error("Failed to fetch compliance:", error);
    return NextResponse.json({ error: "Failed to fetch compliance" }, { status: 500 });
  }
}
