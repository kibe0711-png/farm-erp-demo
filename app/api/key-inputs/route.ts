import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const keyInputs = await prisma.cropKeyInput.findMany({
      orderBy: [{ cropCode: "asc" }],
      take: 1000,
    });
    return NextResponse.json(keyInputs);
  } catch (error) {
    console.error("Failed to fetch key inputs:", error);
    return NextResponse.json({ error: "Failed to fetch data" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json();

    if (!Array.isArray(data) || data.length === 0) {
      return NextResponse.json({ error: "Invalid data format" }, { status: 400 });
    }

    const parseWk = (row: Record<string, string>, key: string): number | null => {
      const val = String(row[key] || "").trim();
      if (val === "") return null;
      const parsed = parseFloat(val);
      return isNaN(parsed) ? null : parsed;
    };

    const records = data
      .map((row: Record<string, string>) => {
        const cropCode = String(row.cropCode || row.crop_code || row.CropCode || "").trim();
        const nurseryDays = parseInt(String(row.nurseryDays || row.nursery_days || row.NurseryDays || "0").replace(/[^\d]/g, ""), 10) || 0;
        const outgrowingDays = parseInt(String(row.outgrowingDays || row.outgrowing_days || row.OutgrowingDays || "0").replace(/[^\d]/g, ""), 10) || 0;
        const yieldPerHa = parseFloat(String(row.yieldPerHa || row.yield_per_ha || row.YieldPerHa || "0").replace(/[^\d.]/g, "")) || 0;
        const harvestWeeks = parseInt(String(row.harvestWeeks || row.harvest_weeks || row.HarvestWeeks || "0").replace(/[^\d]/g, ""), 10) || 0;

        const rejectRateRaw = String(row.rejectRate || row.reject_rate || row.RejectRate || "0").trim();
        const rejectRate = parseFloat(rejectRateRaw.replace(/%/g, "").replace(/[^\d.]/g, "")) || 0;

        return {
          cropCode,
          nurseryDays,
          outgrowingDays,
          yieldPerHa,
          harvestWeeks,
          rejectRate,
          wk1: parseWk(row, "wk1"),
          wk2: parseWk(row, "wk2"),
          wk3: parseWk(row, "wk3"),
          wk4: parseWk(row, "wk4"),
          wk5: parseWk(row, "wk5"),
          wk6: parseWk(row, "wk6"),
          wk7: parseWk(row, "wk7"),
          wk8: parseWk(row, "wk8"),
          wk9: parseWk(row, "wk9"),
          wk10: parseWk(row, "wk10"),
          wk11: parseWk(row, "wk11"),
          wk12: parseWk(row, "wk12"),
          wk13: parseWk(row, "wk13"),
          wk14: parseWk(row, "wk14"),
          wk15: parseWk(row, "wk15"),
          wk16: parseWk(row, "wk16"),
        };
      })
      .filter((record) => record.cropCode);

    if (records.length === 0) {
      return NextResponse.json({ error: "No valid records found in CSV" }, { status: 400 });
    }

    const result = await prisma.cropKeyInput.createMany({
      data: records,
    });

    return NextResponse.json({ success: true, count: result.count });
  } catch (error) {
    console.error("Failed to upload key inputs:", error);
    const message = error instanceof Error ? error.message : "Failed to upload data";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    await prisma.cropKeyInput.deleteMany();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete key inputs:", error);
    return NextResponse.json({ error: "Failed to delete data" }, { status: 500 });
  }
}
