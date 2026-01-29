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

    const entries = await prisma.nutriSchedule.findMany({
      where: {
        farmPhaseId: { in: farmPhaseIds },
        weekStartDate: new Date(weekStart),
      },
    });

    return NextResponse.json(entries);
  } catch (error) {
    console.error("Failed to fetch nutri schedule:", error);
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
      entries: { farmPhaseId: number; nutriSopId: number; dayOfWeek: number }[];
      weekStartDate: string;
      farmPhaseIds: number[];
    };

    if (!weekStartDate || !farmPhaseIds?.length) {
      return NextResponse.json({ error: "weekStartDate and farmPhaseIds are required" }, { status: 400 });
    }

    const weekDate = new Date(weekStartDate);

    // Delete existing entries for these phases in this week
    await prisma.nutriSchedule.deleteMany({
      where: {
        farmPhaseId: { in: farmPhaseIds },
        weekStartDate: weekDate,
      },
    });

    // Insert new entries
    if (entries.length > 0) {
      await prisma.nutriSchedule.createMany({
        data: entries.map((e) => ({
          farmPhaseId: e.farmPhaseId,
          nutriSopId: e.nutriSopId,
          weekStartDate: weekDate,
          dayOfWeek: e.dayOfWeek,
        })),
      });
    }

    return NextResponse.json({ success: true, count: entries.length });
  } catch (error) {
    console.error("Failed to save nutri schedule:", error);
    return NextResponse.json({ error: "Failed to save schedule" }, { status: 500 });
  }
}
