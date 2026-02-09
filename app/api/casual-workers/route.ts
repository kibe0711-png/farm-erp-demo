import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withAnalytics } from "@/lib/analytics/api-middleware";

export const GET = withAnalytics(async (request: Request) => {
  try {
    const { searchParams } = new URL(request.url);
    const farm = searchParams.get("farm");

    const where = farm ? { farm } : {};

    const workers = await prisma.casualWorker.findMany({
      where,
      orderBy: { name: "asc" },
    });

    return NextResponse.json(workers);
  } catch (error) {
    console.error("Failed to fetch casual workers:", error);
    return NextResponse.json({ error: "Failed to fetch data" }, { status: 500 });
  }
});
