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

    // Parse date and create date range for the entire day (to handle timezone variations)
    const queryDate = new Date(weekStart);
    const startOfDay = new Date(queryDate.getFullYear(), queryDate.getMonth(), queryDate.getDate());
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);
    endOfDay.setMilliseconds(-1);

    const entries = await prisma.harvestSchedule.findMany({
      where: {
        farmPhaseId: { in: farmPhaseIds },
        weekStartDate: {
          gte: startOfDay,
          lt: endOfDay,
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

    // Parse date and create date range for the entire day (to handle timezone variations)
    const queryDate = new Date(weekStartDate);
    const startOfDay = new Date(queryDate.getFullYear(), queryDate.getMonth(), queryDate.getDate());
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);
    endOfDay.setMilliseconds(-1);

    // Delete existing entries for these phases in this week
    await prisma.harvestSchedule.deleteMany({
      where: {
        farmPhaseId: { in: farmPhaseIds },
        weekStartDate: {
          gte: startOfDay,
          lt: endOfDay,
        },
      },
    });

    // Insert new entries
    if (entries.length > 0) {
      await prisma.harvestSchedule.createMany({
        data: entries.map((e) => ({
          farmPhaseId: e.farmPhaseId,
          weekStartDate: startOfDay,
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
