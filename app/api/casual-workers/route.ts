import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withAnalytics } from "@/lib/analytics/api-middleware";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { hasPermission, Permission } from "@/lib/auth/roles";

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

export const POST = withAnalytics(async (request: Request) => {
  try {
    const authUser = await getAuthUser();
    if (!authUser || !hasPermission(authUser.role, Permission.ENTRY_LABOR)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await request.json();
    const { name, nationalId, phone, farm } = body;

    if (!name?.trim() || !farm?.trim()) {
      return NextResponse.json({ error: "Name and farm are required" }, { status: 400 });
    }

    // Resolve farmId
    let farmId: number | null = null;
    const farmRecord = await prisma.farm.findUnique({ where: { name: farm } });
    if (farmRecord) farmId = farmRecord.id;

    const worker = await prisma.casualWorker.create({
      data: {
        name: name.trim(),
        nationalId: nationalId?.trim() || null,
        phone: phone?.trim() || null,
        farm: farm.trim(),
        farmId,
      },
    });

    return NextResponse.json(worker, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Unique constraint")) {
      return NextResponse.json({ error: "A worker with this name already exists on this farm" }, { status: 409 });
    }
    console.error("Failed to create casual worker:", error);
    return NextResponse.json({ error: "Failed to create worker" }, { status: 500 });
  }
});
