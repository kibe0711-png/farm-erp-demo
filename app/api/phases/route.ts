import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

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

export async function GET() {
  try {
    const phases = await prisma.farmPhase.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return NextResponse.json(phases);
  } catch (error) {
    console.error("Failed to fetch phases:", error);
    return NextResponse.json({ error: "Failed to fetch data" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json();

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

    const result = await prisma.farmPhase.createMany({
      data: records,
    });

    return NextResponse.json({ success: true, count: result.count });
  } catch (error) {
    console.error("Failed to upload phases:", error);
    const message = error instanceof Error ? error.message : "Failed to upload data";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    await prisma.farmPhase.deleteMany();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete phases:", error);
    return NextResponse.json({ error: "Failed to delete data" }, { status: 500 });
  }
}
