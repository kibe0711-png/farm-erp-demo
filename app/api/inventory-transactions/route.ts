import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { hasPermission, Permission } from "@/lib/auth/roles";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const productInventoryId = searchParams.get("productInventoryId");
    const farmId = searchParams.get("farmId");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const type = searchParams.get("type");

    const where: Record<string, unknown> = {};
    if (productInventoryId) where.productInventoryId = parseInt(productInventoryId, 10);
    if (type) where.type = type;
    if (farmId) {
      where.productInventory = { farmId: parseInt(farmId, 10) };
    }
    if (dateFrom || dateTo) {
      const dateFilter: Record<string, Date> = {};
      if (dateFrom) dateFilter.gte = new Date(dateFrom);
      if (dateTo) dateFilter.lte = new Date(dateTo);
      where.date = dateFilter;
    }

    const transactions = await prisma.inventoryTransaction.findMany({
      where,
      include: {
        productInventory: {
          select: { product: true, category: true, unit: true, farmId: true },
        },
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    });

    return NextResponse.json(
      transactions.map((t) => ({
        id: t.id,
        productInventoryId: t.productInventoryId,
        product: t.productInventory.product,
        category: t.productInventory.category,
        unit: t.productInventory.unit,
        type: t.type,
        quantity: Number(t.quantity),
        date: t.date.toISOString().split("T")[0],
        notes: t.notes,
        recordedBy: t.recordedBy,
        createdAt: t.createdAt.toISOString(),
      }))
    );
  } catch (error) {
    console.error("Failed to fetch inventory transactions:", error);
    return NextResponse.json({ error: "Failed to fetch transactions" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getAuthUser();
    if (!user || !hasPermission(user.role, Permission.ENTRY_NUTRITION)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const data = await request.json();
    const items = Array.isArray(data) ? data : [data];

    if (items.length === 0) {
      return NextResponse.json({ error: "No items provided" }, { status: 400 });
    }

    // Validate all items first
    for (const item of items) {
      const { productInventoryId, type, quantity, date } = item;
      if (!productInventoryId || !type || !quantity || !date) {
        return NextResponse.json(
          { error: "Each item requires productInventoryId, type, quantity, and date" },
          { status: 400 }
        );
      }
      if (type !== "IN" && type !== "OUT") {
        return NextResponse.json({ error: "type must be 'IN' or 'OUT'" }, { status: 400 });
      }
      const qty = parseFloat(String(quantity));
      if (isNaN(qty) || qty <= 0) {
        return NextResponse.json({ error: "quantity must be a positive number" }, { status: 400 });
      }
    }

    // Atomic batch: create all transactions + update all balances
    const result = await prisma.$transaction(async (tx) => {
      const created = [];
      for (const item of items) {
        const qty = parseFloat(String(item.quantity));
        const txn = await tx.inventoryTransaction.create({
          data: {
            productInventoryId: parseInt(String(item.productInventoryId), 10),
            type: item.type,
            quantity: qty,
            date: new Date(item.date),
            notes: item.notes || null,
            recordedBy: user.id,
          },
        });

        const delta = item.type === "IN" ? qty : -qty;
        await tx.productInventory.update({
          where: { id: parseInt(String(item.productInventoryId), 10) },
          data: { quantity: { increment: delta } },
        });

        created.push(txn);
      }
      return created;
    });

    return NextResponse.json({ success: true, count: result.length });
  } catch (error) {
    console.error("Failed to create inventory transactions:", error);
    const message = error instanceof Error ? error.message : "Failed to create transactions";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await getAuthUser();
    if (!user || !hasPermission(user.role, Permission.MANAGE_CROPS)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const txn = await prisma.inventoryTransaction.findUnique({
      where: { id: parseInt(id, 10) },
    });
    if (!txn) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    // Reverse the balance and delete
    await prisma.$transaction(async (tx) => {
      const reverseDelta = txn.type === "IN" ? -Number(txn.quantity) : Number(txn.quantity);
      await tx.productInventory.update({
        where: { id: txn.productInventoryId },
        data: { quantity: { increment: reverseDelta } },
      });
      await tx.inventoryTransaction.delete({
        where: { id: parseInt(id, 10) },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete inventory transaction:", error);
    return NextResponse.json({ error: "Failed to delete transaction" }, { status: 500 });
  }
}
