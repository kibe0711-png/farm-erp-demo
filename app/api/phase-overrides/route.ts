import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET ?farmPhaseIds=1,2,3&weekStart=2026-01-26&sopType=labor
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const idsParam = searchParams.get("farmPhaseIds");
    const weekStart = searchParams.get("weekStart");
    const sopType = searchParams.get("sopType");

    if (!idsParam || !weekStart || !sopType) {
      return NextResponse.json(
        { error: "farmPhaseIds, weekStart, and sopType are required" },
        { status: 400 }
      );
    }

    const farmPhaseIds = idsParam.split(",").map(Number).filter((n) => !isNaN(n));

    const overrides = await prisma.phaseActivityOverride.findMany({
      where: {
        farmPhaseId: { in: farmPhaseIds },
        weekStart: new Date(weekStart),
        sopType,
      },
    });

    return NextResponse.json(overrides);
  } catch (error) {
    console.error("Failed to fetch phase overrides:", error);
    return NextResponse.json({ error: "Failed to fetch overrides" }, { status: 500 });
  }
}

// POST — upsert an override
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { farmPhaseId, sopId, sopType, action, weekStart } = body as {
      farmPhaseId: number;
      sopId: number;
      sopType: string;
      action: string;
      weekStart: string;
    };

    if (!farmPhaseId || !sopId || !sopType || !action || !weekStart) {
      return NextResponse.json(
        { error: "farmPhaseId, sopId, sopType, action, and weekStart are required" },
        { status: 400 }
      );
    }

    if (!["labor", "nutri"].includes(sopType)) {
      return NextResponse.json({ error: "sopType must be 'labor' or 'nutri'" }, { status: 400 });
    }

    if (!["add", "remove"].includes(action)) {
      return NextResponse.json({ error: "action must be 'add' or 'remove'" }, { status: 400 });
    }

    const weekDate = new Date(weekStart);

    const override = await prisma.phaseActivityOverride.upsert({
      where: {
        farmPhaseId_sopId_sopType_weekStart: {
          farmPhaseId,
          sopId,
          sopType,
          weekStart: weekDate,
        },
      },
      update: { action },
      create: {
        farmPhaseId,
        sopId,
        sopType,
        action,
        weekStart: weekDate,
      },
    });

    return NextResponse.json(override);
  } catch (error) {
    console.error("Failed to upsert phase override:", error);
    return NextResponse.json({ error: "Failed to save override" }, { status: 500 });
  }
}

// DELETE ?farmPhaseId=1&sopId=5&sopType=labor&weekStart=2026-01-26
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const farmPhaseId = Number(searchParams.get("farmPhaseId"));
    const sopId = Number(searchParams.get("sopId"));
    const sopType = searchParams.get("sopType");
    const weekStart = searchParams.get("weekStart");

    if (!farmPhaseId || !sopId || !sopType || !weekStart) {
      return NextResponse.json(
        { error: "farmPhaseId, sopId, sopType, and weekStart are required" },
        { status: 400 }
      );
    }

    await prisma.phaseActivityOverride.delete({
      where: {
        farmPhaseId_sopId_sopType_weekStart: {
          farmPhaseId,
          sopId,
          sopType,
          weekStart: new Date(weekStart),
        },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete phase override:", error);
    return NextResponse.json({ error: "Failed to delete override" }, { status: 500 });
  }
}
