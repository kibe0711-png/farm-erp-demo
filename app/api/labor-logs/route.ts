import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const records = await prisma.laborLog.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(records);
  } catch (error) {
    console.error("Failed to fetch labor logs:", error);
    return NextResponse.json({ error: "Failed to fetch data" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json();

    const record = await prisma.laborLog.create({
      data: {
        farmPhaseId: data.farmPhaseId,
        logDate: new Date(data.logDate),
        task: data.task,
        casuals: parseInt(data.casuals) || 0,
        costPerDay: parseFloat(data.costPerDay) || 0,
        totalCost: parseFloat(data.totalCost) || 0,
        notes: data.notes || null,
      },
    });

    return NextResponse.json({ success: true, record });
  } catch (error) {
    console.error("Failed to create labor log:", error);
    const message = error instanceof Error ? error.message : "Failed to create record";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (id) {
      await prisma.laborLog.delete({
        where: { id: parseInt(id) },
      });
    } else {
      await prisma.laborLog.deleteMany();
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete labor log:", error);
    return NextResponse.json({ error: "Failed to delete data" }, { status: 500 });
  }
}
