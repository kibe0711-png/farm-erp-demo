import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { hasPermission, Permission } from "@/lib/auth/roles";

// GET ?weekStart=2026-01-26 — Check if snapshot exists and return metadata
// GET ?weekStart=2026-01-26&entries=true — Return all snapshot entries
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const weekStart = searchParams.get("weekStart");
    const includeEntries = searchParams.get("entries") === "true";

    if (!weekStart) {
      return NextResponse.json({ error: "weekStart is required" }, { status: 400 });
    }

    const weekDate = new Date(weekStart + "T00:00:00.000Z");

    // If entries requested, return all snapshot rows
    if (includeEntries) {
      const allEntries = await prisma.feedingSnapshot.findMany({
        where: { weekStartDate: weekDate },
      });

      return NextResponse.json({
        entries: allEntries.map((e) => ({
          farmPhaseId: e.farmPhaseId,
          phaseId: e.phaseId,
          cropCode: e.cropCode,
          farm: e.farm,
          product: e.product,
          expectedRateHa: Number(e.expectedRateHa),
          expectedQty: Number(e.expectedQty),
          actualQty: Number(e.actualQty),
          actualRateHa: Number(e.actualRateHa),
          variance: Number(e.variance),
        })),
      });
    }

    const firstEntry = await prisma.feedingSnapshot.findFirst({
      where: { weekStartDate: weekDate },
      select: { snapshotAt: true, savedBy: true },
    });

    if (!firstEntry) {
      return NextResponse.json({ exists: false });
    }

    // Get entry count
    const count = await prisma.feedingSnapshot.count({
      where: { weekStartDate: weekDate },
    });

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
      entryCount: count,
    });
  } catch (error) {
    console.error("Failed to check feeding snapshot:", error);
    return NextResponse.json({ error: "Failed to check snapshot" }, { status: 500 });
  }
}

// POST — Save feeding snapshot for a week
// Body: { weekStartDate: string, entries: FeedingSnapshotEntry[] }
export async function POST(request: Request) {
  try {
    const authUser = await getAuthUser();
    if (!authUser || !hasPermission(authUser.role, Permission.MANAGE_CROPS)) {
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
      product: string;
      expectedRateHa: number;
      expectedQty: number;
      actualQty: number;
      actualRateHa: number;
      variance: number;
    }) => ({
      weekStartDate: weekDate,
      farmPhaseId: e.farmPhaseId,
      phaseId: e.phaseId,
      cropCode: e.cropCode,
      farm: e.farm,
      product: e.product,
      expectedRateHa: e.expectedRateHa,
      expectedQty: e.expectedQty,
      actualQty: e.actualQty,
      actualRateHa: e.actualRateHa,
      variance: e.variance,
      savedBy: authUser.id,
    }));

    // Delete existing snapshot for this week, then insert new entries
    await prisma.$transaction([
      prisma.feedingSnapshot.deleteMany({ where: { weekStartDate: weekDate } }),
      prisma.feedingSnapshot.createMany({ data: records }),
    ]);

    return NextResponse.json({
      success: true,
      count: records.length,
      snapshotAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Failed to save feeding snapshot:", error);
    return NextResponse.json({ error: "Failed to save snapshot" }, { status: 500 });
  }
}
