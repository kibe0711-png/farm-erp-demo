import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { hasPermission, Permission } from "@/lib/auth/roles";

// GET ?weekStart=2026-01-26
// Check if a snapshot exists for the given week and return metadata
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const weekStart = searchParams.get("weekStart");

    if (!weekStart) {
      return NextResponse.json({ error: "weekStart is required" }, { status: 400 });
    }

    const weekDate = new Date(weekStart + "T00:00:00.000Z");

    const firstEntry = await prisma.complianceSnapshot.findFirst({
      where: { weekStartDate: weekDate },
      select: { snapshotAt: true, savedBy: true },
    });

    if (!firstEntry) {
      return NextResponse.json({ exists: false });
    }

    // Get summary counts
    const entries = await prisma.complianceSnapshot.findMany({
      where: { weekStartDate: weekDate },
      select: { status: true },
    });

    const done = entries.filter((e) => e.status === "done").length;
    const missed = entries.filter((e) => e.status === "missed").length;
    const pending = entries.filter((e) => e.status === "pending").length;
    const upcoming = entries.filter((e) => e.status === "upcoming").length;
    const total = entries.length;
    const countable = done + missed;
    const complianceRate = countable > 0 ? Math.round((done / countable) * 100) : null;

    // Get saver's name
    let savedByName = "Unknown";
    try {
      const user = await prisma.user.findUnique({
        where: { id: firstEntry.savedBy },
        select: { name: true },
      });
      if (user) savedByName = user.name;
    } catch {
      // ignore
    }

    return NextResponse.json({
      exists: true,
      snapshotAt: firstEntry.snapshotAt.toISOString(),
      savedByName,
      summary: { total, done, missed, pending, upcoming, complianceRate },
    });
  } catch (error) {
    console.error("Failed to check compliance snapshot:", error);
    return NextResponse.json({ error: "Failed to check snapshot" }, { status: 500 });
  }
}

// DELETE ?weekStart=2026-01-26
// Remove a snapshot for the given week, reverting to live compliance
export async function DELETE(request: Request) {
  try {
    const authUser = await getAuthUser();
    if (!authUser || !hasPermission(authUser.role, Permission.MANAGE_USERS)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const weekStart = searchParams.get("weekStart");

    if (!weekStart) {
      return NextResponse.json({ error: "weekStart is required" }, { status: 400 });
    }

    const weekDate = new Date(weekStart + "T00:00:00.000Z");

    const result = await prisma.complianceSnapshot.deleteMany({
      where: { weekStartDate: weekDate },
    });

    return NextResponse.json({ success: true, deleted: result.count });
  } catch (error) {
    console.error("Failed to delete compliance snapshot:", error);
    return NextResponse.json({ error: "Failed to delete snapshot" }, { status: 500 });
  }
}

// POST — Save compliance snapshot for a week
// Body: { weekStartDate: string, entries: ComplianceEntry[] }
export async function POST(request: Request) {
  try {
    const authUser = await getAuthUser();
    if (!authUser || !hasPermission(authUser.role, Permission.MANAGE_USERS)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await request.json();
    const { weekStartDate, entries } = body;

    if (!weekStartDate || !Array.isArray(entries) || entries.length === 0) {
      return NextResponse.json(
        { error: "weekStartDate and non-empty entries array are required" },
        { status: 400 }
      );
    }

    const weekDate = new Date(weekStartDate + "T00:00:00.000Z");

    const records = entries.map((e: {
      farmPhaseId: number;
      phaseId: string;
      cropCode: string;
      farm: string;
      type: string;
      task: string;
      dayOfWeek: number;
      status: string;
    }) => ({
      weekStartDate: weekDate,
      farmPhaseId: e.farmPhaseId,
      phaseId: e.phaseId,
      cropCode: e.cropCode,
      farm: e.farm,
      type: e.type,
      task: e.task,
      dayOfWeek: e.dayOfWeek,
      status: e.status,
      savedBy: authUser.id,
    }));

    // Delete existing snapshot for this week, then insert new entries
    await prisma.$transaction([
      prisma.complianceSnapshot.deleteMany({ where: { weekStartDate: weekDate } }),
      prisma.complianceSnapshot.createMany({ data: records }),
    ]);

    return NextResponse.json({
      success: true,
      count: records.length,
      snapshotAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Failed to save compliance snapshot:", error);
    return NextResponse.json({ error: "Failed to save snapshot" }, { status: 500 });
  }
}
