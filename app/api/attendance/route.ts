import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withAnalytics } from "@/lib/analytics/api-middleware";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { hasPermission, Permission } from "@/lib/auth/roles";

function getMondayOfDate(dateStr: string): Date {
  const d = new Date(dateStr);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  return monday;
}

export const GET = withAnalytics(async (request: Request) => {
  try {
    const { searchParams } = new URL(request.url);
    const farm = searchParams.get("farm");
    const date = searchParams.get("date");
    const weekStart = searchParams.get("weekStart");

    const where: Record<string, unknown> = {};
    if (farm) where.farm = farm;

    if (date) {
      where.date = new Date(date);
    } else if (weekStart) {
      const start = new Date(weekStart);
      const end = new Date(weekStart);
      end.setDate(end.getDate() + 6);
      where.date = { gte: start, lte: end };
    }

    const records = await prisma.attendanceRecord.findMany({
      where,
      include: {
        casualWorker: { select: { name: true, nationalId: true, phone: true } },
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    });

    return NextResponse.json(
      records.map((r) => ({
        id: r.id,
        casualWorkerId: r.casualWorkerId,
        casualWorker: r.casualWorker,
        date: r.date.toISOString().split("T")[0],
        weekStartDate: r.weekStartDate.toISOString().split("T")[0],
        farmPhaseId: r.farmPhaseId,
        activity: r.activity,
        rateType: r.rateType,
        rate: Number(r.rate),
        units: Number(r.units),
        adjustment: Number(r.adjustment),
        amount: Number(r.amount),
        farm: r.farm,
        farmId: r.farmId,
        notes: r.notes,
        recordedBy: r.recordedBy,
        createdAt: r.createdAt.toISOString(),
      }))
    );
  } catch (error) {
    console.error("Failed to fetch attendance records:", error);
    return NextResponse.json({ error: "Failed to fetch data" }, { status: 500 });
  }
});

export const POST = withAnalytics(async (request: Request) => {
  try {
    const user = await getAuthUser();
    if (!user || !hasPermission(user.role, Permission.ENTRY_LABOR)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const data = await request.json();
    const entries = Array.isArray(data) ? data : [data];

    const results = [];
    const errors = [];

    for (const entry of entries) {
      try {
        const rate = parseFloat(entry.rate) || 0;
        const units = parseFloat(entry.units) || 1;
        const adjustment = parseFloat(entry.adjustment) || 0;
        const amount = rate * units - adjustment;

        const dateStr = String(entry.date);
        const monday = getMondayOfDate(dateStr);

        const record = await prisma.attendanceRecord.create({
          data: {
            casualWorkerId: parseInt(entry.casualWorkerId),
            date: new Date(dateStr),
            weekStartDate: monday,
            farmPhaseId: parseInt(entry.farmPhaseId),
            activity: String(entry.activity),
            rateType: String(entry.rateType || "daily"),
            rate,
            units,
            adjustment,
            amount,
            farm: String(entry.farm),
            farmId: entry.farmId ? parseInt(entry.farmId) : null,
            notes: entry.notes || null,
            recordedBy: user.id,
          },
        });
        results.push(record.id);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to create";
        errors.push({ casualWorkerId: entry.casualWorkerId, activity: entry.activity, error: message });
      }
    }

    return NextResponse.json({
      success: true,
      created: results.length,
      ids: results,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("Failed to create attendance record:", error);
    const message = error instanceof Error ? error.message : "Failed to create record";
    return NextResponse.json({ error: message }, { status: 500 });
  }
});

export const DELETE = withAnalytics(async (request: Request) => {
  try {
    const user = await getAuthUser();
    if (!user || !hasPermission(user.role, Permission.ENTRY_LABOR)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "id parameter required" }, { status: 400 });
    }

    await prisma.attendanceRecord.delete({
      where: { id: parseInt(id) },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete attendance record:", error);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
});
