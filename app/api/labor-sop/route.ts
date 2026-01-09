import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const laborSop = await prisma.laborSop.findMany({
      orderBy: [{ cropCode: "asc" }, { week: "asc" }],
      take: 1000,
    });
    return NextResponse.json(laborSop);
  } catch (error) {
    console.error("Failed to fetch labor SOP:", error);
    return NextResponse.json({ error: "Failed to fetch data" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json();

    if (!Array.isArray(data) || data.length === 0) {
      return NextResponse.json({ error: "Invalid data format" }, { status: 400 });
    }

    const records = data
      .map((row: Record<string, string>) => {
        // Find the week value
        const weekValue = row.week || row.Week || row.WEEK || "0";
        const weekStr = String(weekValue).trim();
        const weekMatch = weekStr.match(/\d+/);
        const weekNum = weekMatch ? parseInt(weekMatch[0], 10) : 0;

        return {
          cropCode: String(row.crop_code || row.cropCode || row.Crop_Code || "").trim(),
          week: weekNum,
          task: String(row.task || row.Task || "").trim(),
          noOfCasuals: parseInt(String(row.no_of_casuals || row.noOfCasuals || row.No_of_Casuals || "0").replace(/[^\d]/g, ""), 10) || 0,
          costPerCasualDay: parseFloat(String(row.cost_per_casual_day || row.costPerCasualDay || row.Cost_per_Casual_Day || "0").replace(/[^\d.]/g, "")) || 0,
          noOfDays: parseInt(String(row.no_of_days || row.noOfDays || row.No_of_Days || "0").replace(/[^\d]/g, ""), 10) || 0,
        };
      })
      .filter((record) => record.cropCode && record.task); // Skip empty rows

    if (records.length === 0) {
      return NextResponse.json({ error: "No valid records found in CSV" }, { status: 400 });
    }

    const result = await prisma.laborSop.createMany({
      data: records,
    });

    return NextResponse.json({ success: true, count: result.count });
  } catch (error) {
    console.error("Failed to upload labor SOP:", error);
    const message = error instanceof Error ? error.message : "Failed to upload data";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    await prisma.laborSop.deleteMany();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete labor SOP:", error);
    return NextResponse.json({ error: "Failed to delete data" }, { status: 500 });
  }
}
