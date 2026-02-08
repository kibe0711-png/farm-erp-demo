import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { hasPermission, Permission } from "@/lib/auth/roles";
import { withAnalytics } from "@/lib/analytics/api-middleware";

function parseDate(dateStr: string): Date {
  if (!dateStr) return new Date();

  // Handle DD/MM/YYYY format
  if (dateStr.includes("/")) {
    const parts = dateStr.split("/");
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1; // months are 0-indexed
      const year = parseInt(parts[2], 10);
      return new Date(year, month, day);
    }
  }

  // Handle YYYY-MM-DD or other formats
  return new Date(dateStr);
}

export const GET = withAnalytics(async (request: Request) => {
  try {
    const { searchParams } = new URL(request.url);
    const includeArchived = searchParams.get("includeArchived") === "true";

    const phases = await prisma.farmPhase.findMany({
      where: includeArchived ? {} : { archived: false },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(phases);
  } catch (error) {
    console.error("Failed to fetch phases:", error);
    return NextResponse.json({ error: "Failed to fetch data" }, { status: 500 });
  }
});

export const POST = withAnalytics(async (request: Request) => {
  try {
    const data = await request.json();

    // Single phase creation (object) — requires MANAGE_CROPS
    if (!Array.isArray(data) && typeof data === "object" && data !== null) {
      const authUser = await getAuthUser();
      if (!authUser || !hasPermission(authUser.role, Permission.MANAGE_CROPS)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
      }

      const sowingDate = parseDate(data.sowingDate || "");
      const areaHa = parseFloat(data.areaHa) || 0;

      let farmId: number | null = null;
      if (data.farm) {
        const farmRecord = await prisma.farm.upsert({
          where: { name: data.farm },
          update: {},
          create: { name: data.farm },
        });
        farmId = farmRecord.id;
      }

      const phase = await prisma.farmPhase.create({
        data: {
          cropCode: data.cropCode || "",
          phaseId: data.phaseId || "",
          sowingDate,
          farm: data.farm || "",
          farmId,
          areaHa,
        },
      });

      return NextResponse.json({ success: true, phase });
    }

    // Bulk CSV upload (array) — no auth change
    if (!Array.isArray(data) || data.length === 0) {
      return NextResponse.json({ error: "Invalid data format" }, { status: 400 });
    }

    const records = data.map((row: Record<string, string>) => {
      const sowingDateStr = row.sowing_date || row.sowingDate || "";
      const sowingDate = parseDate(sowingDateStr);
      const areaHaStr = row.area_ha || row.areaHa || row["area_ha"] || "0";
      const areaHa = parseFloat(areaHaStr) || 0;

      return {
        cropCode: row.crop_code || row.cropCode || "",
        phaseId: row.phase_id || row.phaseId || "",
        sowingDate,
        farm: row.farm || "",
        areaHa,
      };
    });

    // Find-or-create Farm records for each unique farm name
    const uniqueFarmNames = [...new Set(records.map((r) => r.farm).filter(Boolean))];
    const farmMap = new Map<string, number>();
    for (const name of uniqueFarmNames) {
      const farm = await prisma.farm.upsert({
        where: { name },
        update: {},
        create: { name },
      });
      farmMap.set(name, farm.id);
    }

    const recordsWithFarmId = records.map((r) => ({
      ...r,
      farmId: farmMap.get(r.farm) ?? null,
    }));

    const result = await prisma.farmPhase.createMany({
      data: recordsWithFarmId,
    });

    return NextResponse.json({ success: true, count: result.count });
  } catch (error) {
    console.error("Failed to upload phases:", error);
    const message = error instanceof Error ? error.message : "Failed to upload data";
    return NextResponse.json({ error: message }, { status: 500 });
  }
});

export const PATCH = withAnalytics(async (request: Request) => {
  try {
    const authUser = await getAuthUser();
    if (!authUser || !hasPermission(authUser.role, Permission.MANAGE_CROPS)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await request.json();
    const { id, cropCode, phaseId, sowingDate, farm, areaHa, archived } = body;

    if (!id) {
      return NextResponse.json({ error: "Phase id is required" }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    if (cropCode !== undefined) updateData.cropCode = cropCode;
    if (phaseId !== undefined) updateData.phaseId = phaseId;
    if (sowingDate !== undefined) updateData.sowingDate = parseDate(sowingDate);
    if (farm !== undefined) {
      updateData.farm = farm;
      const farmRecord = await prisma.farm.upsert({
        where: { name: farm },
        update: {},
        create: { name: farm },
      });
      updateData.farmId = farmRecord.id;
    }
    if (areaHa !== undefined) updateData.areaHa = parseFloat(areaHa) || 0;
    if (archived !== undefined) updateData.archived = Boolean(archived);

    const phase = await prisma.farmPhase.update({
      where: { id: Number(id) },
      data: updateData,
    });

    return NextResponse.json(phase);
  } catch (error) {
    console.error("Failed to update phase:", error);
    return NextResponse.json({ error: "Failed to update phase" }, { status: 500 });
  }
});

export const DELETE = withAnalytics(async (request: Request) => {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (id) {
      // Single phase deletion — requires MANAGE_CROPS
      const authUser = await getAuthUser();
      if (!authUser || !hasPermission(authUser.role, Permission.MANAGE_CROPS)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
      }
      await prisma.farmPhase.delete({
        where: { id: parseInt(id) },
      });
    } else {
      // Bulk delete all (existing behavior)
      await prisma.farmPhase.deleteMany();
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete phases:", error);
    return NextResponse.json({ error: "Failed to delete data" }, { status: 500 });
  }
});
