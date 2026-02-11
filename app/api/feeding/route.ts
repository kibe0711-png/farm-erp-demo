import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withAnalytics } from "@/lib/analytics/api-middleware";
import { getAuthUser } from "@/lib/auth/getAuthUser";

export const GET = withAnalytics(async () => {
  try {
    const records = await prisma.feedingRecord.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(records);
  } catch (error) {
    console.error("Failed to fetch feeding records:", error);
    return NextResponse.json({ error: "Failed to fetch data" }, { status: 500 });
  }
});

export const POST = withAnalytics(async (request: Request) => {
  try {
    const user = await getAuthUser();
    const data = await request.json();
    const actualQty = parseFloat(data.actualQty) || 0;

    // Create feeding record + auto-deduct from inventory atomically
    const result = await prisma.$transaction(async (tx) => {
      const record = await tx.feedingRecord.create({
        data: {
          farmPhaseId: data.farmPhaseId,
          applicationDate: new Date(data.applicationDate),
          product: data.product,
          actualRateHa: parseFloat(data.actualRateHa) || 0,
          actualQty,
          notes: data.notes || null,
        },
      });

      // Auto-deduct from inventory if product+farm exists
      if (actualQty > 0) {
        const phase = await tx.farmPhase.findUnique({
          where: { id: data.farmPhaseId },
          select: { farmId: true },
        });

        if (phase?.farmId) {
          const inventory = await tx.productInventory.findUnique({
            where: {
              product_farmId: {
                product: data.product,
                farmId: phase.farmId,
              },
            },
          });

          if (inventory) {
            await tx.productInventory.update({
              where: { id: inventory.id },
              data: { quantity: { decrement: actualQty } },
            });

            await tx.inventoryTransaction.create({
              data: {
                productInventoryId: inventory.id,
                type: "OUT",
                quantity: actualQty,
                date: new Date(data.applicationDate),
                notes: "Auto: Feeding record",
                recordedBy: user?.id ?? 0,
              },
            });
          }
        }
      }

      return record;
    });

    return NextResponse.json({ success: true, record: result });
  } catch (error) {
    console.error("Failed to create feeding record:", error);
    const message = error instanceof Error ? error.message : "Failed to create record";
    return NextResponse.json({ error: message }, { status: 500 });
  }
});

export const DELETE = withAnalytics(async (request: Request) => {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (id) {
      // Reverse inventory deduction before deleting
      const record = await prisma.feedingRecord.findUnique({
        where: { id: parseInt(id) },
      });

      if (record) {
        await prisma.$transaction(async (tx) => {
          // Find the phase to get farmId
          const phase = await tx.farmPhase.findUnique({
            where: { id: record.farmPhaseId },
            select: { farmId: true },
          });

          if (phase?.farmId) {
            const inventory = await tx.productInventory.findUnique({
              where: {
                product_farmId: {
                  product: record.product,
                  farmId: phase.farmId,
                },
              },
            });

            if (inventory) {
              const qty = Number(record.actualQty);
              // Restore inventory balance
              await tx.productInventory.update({
                where: { id: inventory.id },
                data: { quantity: { increment: qty } },
              });

              // Delete the auto-generated transaction
              await tx.inventoryTransaction.deleteMany({
                where: {
                  productInventoryId: inventory.id,
                  type: "OUT",
                  quantity: record.actualQty,
                  notes: "Auto: Feeding record",
                  date: record.applicationDate,
                },
              });
            }
          }

          await tx.feedingRecord.delete({
            where: { id: parseInt(id) },
          });
        });
      }
    } else {
      await prisma.feedingRecord.deleteMany();
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete feeding record:", error);
    return NextResponse.json({ error: "Failed to delete data" }, { status: 500 });
  }
});
