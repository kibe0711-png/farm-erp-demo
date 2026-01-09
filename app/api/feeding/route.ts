import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const records = await prisma.feedingRecord.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(records);
  } catch (error) {
    console.error("Failed to fetch feeding records:", error);
    return NextResponse.json({ error: "Failed to fetch data" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json();

    const record = await prisma.feedingRecord.create({
      data: {
        farmPhaseId: data.farmPhaseId,
        applicationDate: new Date(data.applicationDate),
        product: data.product,
        actualRateHa: parseFloat(data.actualRateHa) || 0,
        actualQty: parseFloat(data.actualQty) || 0,
        notes: data.notes || null,
      },
    });

    return NextResponse.json({ success: true, record });
  } catch (error) {
    console.error("Failed to create feeding record:", error);
    const message = error instanceof Error ? error.message : "Failed to create record";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (id) {
      await prisma.feedingRecord.delete({
        where: { id: parseInt(id) },
      });
    } else {
      await prisma.feedingRecord.deleteMany();
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete feeding record:", error);
    return NextResponse.json({ error: "Failed to delete data" }, { status: 500 });
  }
}
