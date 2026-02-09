import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withAnalytics } from "@/lib/analytics/api-middleware";

export const GET = withAnalytics(async (request: Request) => {
  try {
    const { searchParams } = new URL(request.url);
    const farm = searchParams.get("farm");

    const where = farm ? { farm } : {};

    const rates = await prisma.activityRate.findMany({
      where,
      orderBy: { activity: "asc" },
    });

    return NextResponse.json(
      rates.map((r) => ({
        id: r.id,
        activity: r.activity,
        rate: Number(r.rate),
        rateType: r.rateType,
        farm: r.farm,
        farmId: r.farmId,
      }))
    );
  } catch (error) {
    console.error("Failed to fetch activity rates:", error);
    return NextResponse.json({ error: "Failed to fetch data" }, { status: 500 });
  }
});
