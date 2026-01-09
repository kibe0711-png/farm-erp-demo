import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Helper to get value from row with various possible key names
function getValue(row: Record<string, string>, keys: string[]): string {
  for (const key of keys) {
    // Try exact match
    if (row[key] !== undefined) return row[key];
    // Try lowercase
    const lowerKey = key.toLowerCase();
    for (const rowKey of Object.keys(row)) {
      if (rowKey.toLowerCase() === lowerKey) return row[rowKey];
      // Also try with underscores replaced by spaces and vice versa
      if (rowKey.toLowerCase().replace(/\s+/g, "_") === lowerKey) return row[rowKey];
      if (rowKey.toLowerCase().replace(/_/g, " ") === lowerKey.replace(/_/g, " ")) return row[rowKey];
    }
  }
  return "";
}

export async function GET() {
  try {
    const nutriSop = await prisma.nutriSop.findMany({
      orderBy: [{ cropCode: "asc" }, { week: "asc" }],
      take: 1000,
    });
    return NextResponse.json(nutriSop);
  } catch (error) {
    console.error("Failed to fetch nutri SOP:", error);
    return NextResponse.json({ error: "Failed to fetch data" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json();

    if (!Array.isArray(data) || data.length === 0) {
      return NextResponse.json({ error: "Invalid data format" }, { status: 400 });
    }

    // Log first row keys to debug
    console.log("First row keys:", Object.keys(data[0]));
    console.log("First row data:", data[0]);

    const records = data
      .map((row: Record<string, string>) => {
        const weekValue = getValue(row, ["week", "Week", "WEEK"]) || "0";
        const weekStr = String(weekValue).trim();
        const weekMatch = weekStr.match(/\d+/);
        const weekNum = weekMatch ? parseInt(weekMatch[0], 10) : 0;

        const cropCode = String(getValue(row, ["crop_code", "cropCode", "Crop_Code", "crop code"])).trim();
        const products = String(getValue(row, ["products", "Products", "product", "Product"])).trim();
        const activeIngredient = String(getValue(row, ["active_ingredient", "active_ingridient", "activeIngredient", "Active_Ingredient", "active ingredient"])).trim();
        const rateLitre = parseFloat(String(getValue(row, ["rate_litre", "rateLitre", "rate/litre", "Rate_Litre", "rate litre"]) || "0").replace(/[^\d.]/g, "")) || 0;
        const rateHa = parseFloat(String(getValue(row, ["rate_ha", "rateHa", "rate/ha", "Rate_Ha", "rate ha"]) || "0").replace(/[^\d.]/g, "")) || 0;
        const unitPriceRwf = parseFloat(String(getValue(row, ["unit_price_rwf", "unitPriceRwf", "Unit_Price_Rwf", "unit price rwf", "price"]) || "0").replace(/[^\d.]/g, "")) || 0;
        const cost = parseFloat(String(getValue(row, ["cost", "Cost", "COST", "total_cost"]) || "0").replace(/[^\d.]/g, "")) || 0;

        return {
          cropCode,
          week: weekNum,
          products,
          activeIngredient,
          rateLitre,
          rateHa,
          unitPriceRwf,
          cost,
        };
      })
      .filter((record) => record.cropCode && record.products);

    console.log("Valid records:", records.length);
    if (records.length > 0) {
      console.log("First processed record:", records[0]);
    }

    if (records.length === 0) {
      return NextResponse.json({ error: "No valid records found. Make sure CSV has crop_code and products columns." }, { status: 400 });
    }

    const result = await prisma.nutriSop.createMany({
      data: records,
    });

    return NextResponse.json({ success: true, count: result.count });
  } catch (error) {
    console.error("Failed to upload nutri SOP:", error);
    const message = error instanceof Error ? error.message : "Failed to upload data";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    await prisma.nutriSop.deleteMany();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete nutri SOP:", error);
    return NextResponse.json({ error: "Failed to delete data" }, { status: 500 });
  }
}
