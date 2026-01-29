import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const farms = await prisma.farm.findMany({
      orderBy: { name: "asc" },
    });
    return NextResponse.json(farms);
  } catch (error) {
    console.error("Failed to fetch farms:", error);
    return NextResponse.json({ error: "Failed to fetch farms" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, laborRatePerDay } = body;

    if (!id) {
      return NextResponse.json({ error: "Farm id is required" }, { status: 400 });
    }

    const farm = await prisma.farm.update({
      where: { id: Number(id) },
      data: {
        laborRatePerDay: laborRatePerDay != null ? Number(laborRatePerDay) : null,
      },
    });

    return NextResponse.json(farm);
  } catch (error) {
    console.error("Failed to update farm:", error);
    return NextResponse.json({ error: "Failed to update farm" }, { status: 500 });
  }
}
