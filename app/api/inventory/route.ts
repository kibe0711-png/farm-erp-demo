import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { hasPermission, Permission } from "@/lib/auth/roles";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const farmId = searchParams.get("farmId");
    const category = searchParams.get("category");

    const where: Record<string, unknown> = {};
    if (farmId) where.farmId = parseInt(farmId, 10);
    if (category) where.category = category;

    const inventory = await prisma.productInventory.findMany({
      where,
      orderBy: [{ category: "asc" }, { product: "asc" }],
      include: { farm: { select: { name: true } } },
    });

    return NextResponse.json(inventory);
  } catch (error) {
    console.error("Failed to fetch inventory:", error);
    return NextResponse.json({ error: "Failed to fetch inventory" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const authUser = await getAuthUser();
    if (!authUser || !hasPermission(authUser.role, Permission.MANAGE_CROPS)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const data = await request.json();

    // Bulk upsert (array) or single upsert
    const items = Array.isArray(data) ? data : [data];

    const results = [];
    for (const item of items) {
      const { product, category, unit, farmId, quantity } = item;

      if (!product || !category || !unit || !farmId) {
        continue;
      }

      const record = await prisma.productInventory.upsert({
        where: {
          product_farmId: {
            product: String(product).trim(),
            farmId: parseInt(String(farmId), 10),
          },
        },
        update: {
          category: String(category).trim(),
          unit: String(unit).trim(),
          quantity: parseFloat(String(quantity ?? 0)) || 0,
        },
        create: {
          product: String(product).trim(),
          category: String(category).trim(),
          unit: String(unit).trim(),
          farmId: parseInt(String(farmId), 10),
          quantity: parseFloat(String(quantity ?? 0)) || 0,
        },
      });
      results.push(record);
    }

    return NextResponse.json({ success: true, count: results.length });
  } catch (error) {
    console.error("Failed to upsert inventory:", error);
    const message = error instanceof Error ? error.message : "Failed to save inventory";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const authUser = await getAuthUser();
    if (!authUser || !hasPermission(authUser.role, Permission.MANAGE_CROPS)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const data = await request.json();
    const { id, ...updates } = data;

    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    if (updates.product !== undefined) updateData.product = String(updates.product).trim();
    if (updates.category !== undefined) updateData.category = String(updates.category).trim();
    if (updates.unit !== undefined) updateData.unit = String(updates.unit).trim();
    if (updates.quantity !== undefined) updateData.quantity = parseFloat(String(updates.quantity)) || 0;

    const updated = await prisma.productInventory.update({
      where: { id: parseInt(String(id), 10) },
      data: updateData,
    });

    return NextResponse.json({ success: true, record: updated });
  } catch (error) {
    console.error("Failed to update inventory:", error);
    const message = error instanceof Error ? error.message : "Failed to update inventory";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const authUser = await getAuthUser();
    if (!authUser || !hasPermission(authUser.role, Permission.MANAGE_CROPS)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }

    await prisma.productInventory.delete({
      where: { id: parseInt(id, 10) },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete inventory:", error);
    return NextResponse.json({ error: "Failed to delete inventory" }, { status: 500 });
  }
}
