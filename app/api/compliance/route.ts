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
          select: { id: true, phaseId: true, farm: true, cropCode: true },
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
      cropCode: string;
      farm: string;
      task: string;
      dayOfWeek: number;
      status: "done" | "missed" | "pending" | "upcoming";
    }[] = [];

    // Determine today's EAT day-of-week (0=Mon..6=Sun)
    const nowEAT = new Date(new Date().toLocaleString("en-US", { timeZone: "Africa/Kigali" }));
    const todayDow = (nowEAT.getDay() + 6) % 7; // Convert Sun=0 to Mon=0

    // Recover the intended Monday from weekDate. The client sends weekStart
    // via toISOString which shifts the date back one day in EAT (UTC+2):
    // e.g. Mon Feb 2 00:00 EAT → "2026-02-01" (Sunday in UTC).
    // If weekDate is a Sunday, the intended Monday is the NEXT day (+1).
    // If weekDate is already a Monday, no adjustment needed.
    const utcDay = weekDate.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat
    let actualMondayMs: number;
    if (utcDay === 0) {
      // Sunday → intended Monday is next day
      actualMondayMs = weekDate.getTime() + 24 * 60 * 60 * 1000;
    } else if (utcDay === 1) {
      // Already Monday
      actualMondayMs = weekDate.getTime();
    } else {
      // Other days: go back to the previous Monday
      actualMondayMs = weekDate.getTime() - (utcDay - 1) * 24 * 60 * 60 * 1000;
    }
    // Current week's Monday in EAT
    const currentMondayMs = nowEAT.getTime() - todayDow * 24 * 60 * 60 * 1000;
    // Normalize both to day-index for clean comparison
    const actualMondayDay = Math.floor(actualMondayMs / (24 * 60 * 60 * 1000));
    const currentMondayDay = Math.floor(currentMondayMs / (24 * 60 * 60 * 1000));

    // Helper: determine task status by comparing day-of-week indices
    const getStatus = (dayOfWeek: number, hasLog: boolean): "done" | "missed" | "pending" | "upcoming" => {
      if (hasLog) return "done";
      if (actualMondayDay < currentMondayDay) return "missed";   // past week
      if (actualMondayDay > currentMondayDay) return "upcoming"; // future week
      // Same week — compare day indices
      if (dayOfWeek < todayDow) return "missed";
      if (dayOfWeek === todayDow) return "pending";
      return "upcoming";
    };

    laborSchedules.forEach((sched) => {
      const sop = laborSopMap.get(sched.laborSopId);
      const phase = phaseMap.get(sched.farmPhaseId);
      if (!sop || !phase) return;

      const hasLog = laborLogSet.has(`${sched.farmPhaseId}-${sop.task}-${sched.dayOfWeek}`);

      entries.push({
        type: "labor",
        farmPhaseId: sched.farmPhaseId,
        phaseId: phase.phaseId,
        cropCode: phase.cropCode,
        farm: phase.farm,
        task: sop.task,
        dayOfWeek: sched.dayOfWeek,
        status: getStatus(sched.dayOfWeek, hasLog),
      });
    });

    nutriSchedules.forEach((sched) => {
      const sop = nutriSopMap.get(sched.nutriSopId);
      const phase = phaseMap.get(sched.farmPhaseId);
      if (!sop || !phase) return;

      const hasLog = feedingLogSet.has(`${sched.farmPhaseId}-${sop.products}-${sched.dayOfWeek}`);

      entries.push({
        type: "nutri",
        farmPhaseId: sched.farmPhaseId,
        phaseId: phase.phaseId,
        cropCode: phase.cropCode,
        farm: phase.farm,
        task: sop.products,
        dayOfWeek: sched.dayOfWeek,
        status: getStatus(sched.dayOfWeek, hasLog),
      });
    });

    harvestSchedules.forEach((sched) => {
      const phase = phaseMap.get(sched.farmPhaseId);
      if (!phase) return;

      const hasLog = harvestLogSet.has(`${sched.farmPhaseId}-${sched.dayOfWeek}`);

      entries.push({
        type: "harvest",
        farmPhaseId: sched.farmPhaseId,
        phaseId: phase.phaseId,
        cropCode: phase.cropCode,
        farm: phase.farm,
        task: "Harvest",
        dayOfWeek: sched.dayOfWeek,
        status: getStatus(sched.dayOfWeek, hasLog),
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
