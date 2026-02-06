import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { hasPermission, Permission } from "@/lib/auth/roles";

// GET ?farmPhaseIds=1,2,3&weekStart=2026-01-26
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const idsParam = searchParams.get("farmPhaseIds");
    const weekStart = searchParams.get("weekStart");

    if (!idsParam || !weekStart) {
      return NextResponse.json({ error: "farmPhaseIds and weekStart are required" }, { status: 400 });
    }

    const farmPhaseIds = idsParam.split(",").map(Number).filter((n) => !isNaN(n));

    // Parse date string as UTC to match how database stores dates
    // weekStart comes as "YYYY-MM-DD", append T00:00:00.000Z to explicitly use UTC
    const queryDate = new Date(weekStart + "T00:00:00.000Z");
    const nextDay = new Date(queryDate);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);

    const entries = await prisma.harvestSchedule.findMany({
      where: {
        farmPhaseId: { in: farmPhaseIds },
        weekStartDate: {
          gte: queryDate,
          lt: nextDay,
        },
      },
    });

    return NextResponse.json(entries);
  } catch (error) {
    console.error("Failed to fetch harvest schedule:", error);
    return NextResponse.json({ error: "Failed to fetch schedule" }, { status: 500 });
  }
}

// POST — save schedule (replace all entries for given phases/week)
// Requires EDIT_GANTT permission
export async function POST(request: Request) {
  try {
    const authUser = await getAuthUser();
    if (!authUser || !hasPermission(authUser.role, Permission.EDIT_GANTT)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await request.json();
    const { entries, weekStartDate, farmPhaseIds } = body as {
      entries: { farmPhaseId: number; dayOfWeek: number; pledgeKg?: number | null }[];
      weekStartDate: string;
      farmPhaseIds: number[];
    };

    if (!weekStartDate || !farmPhaseIds?.length) {
      return NextResponse.json({ error: "weekStartDate and farmPhaseIds are required" }, { status: 400 });
    }

    // Parse date string as UTC to match how database stores dates
    // weekStartDate comes as "YYYY-MM-DD", append T00:00:00.000Z to explicitly use UTC
    const queryDate = new Date(weekStartDate + "T00:00:00.000Z");
    const nextDay = new Date(queryDate);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);

    // Delete existing entries for these phases in this week
    await prisma.harvestSchedule.deleteMany({
      where: {
        farmPhaseId: { in: farmPhaseIds },
        weekStartDate: {
          gte: queryDate,
          lt: nextDay,
        },
      },
    });

    // Insert new entries
    if (entries.length > 0) {
      await prisma.harvestSchedule.createMany({
        data: entries.map((e) => ({
          farmPhaseId: e.farmPhaseId,
          weekStartDate: queryDate,
          dayOfWeek: e.dayOfWeek,
          pledgeKg: e.pledgeKg != null ? e.pledgeKg : null,
        })),
      });
    }

    return NextResponse.json({ success: true, count: entries.length });
  } catch (error) {
    console.error("Failed to save harvest schedule:", error);
    return NextResponse.json({ error: "Failed to save schedule" }, { status: 500 });
  }
}
