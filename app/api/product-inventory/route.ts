import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET ?category=Fertiliser  (optional filter)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");

    const where: Record<string, unknown> = {};
    if (category) where.category = category;

    const products = await prisma.productInventory.findMany({
      where,
      select: {
        id: true,
        product: true,
        category: true,
        unit: true,
        variety: true,
        cropCode: true,
        farmId: true,
      },
      orderBy: [{ category: "asc" }, { product: "asc" }],
    });

    return NextResponse.json(products);
  } catch (error) {
    console.error("Failed to fetch product inventory:", error);
    return NextResponse.json({ error: "Failed to fetch data" }, { status: 500 });
  }
}
