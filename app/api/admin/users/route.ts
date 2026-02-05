import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { verifyToken } from "@/lib/jwt";
import { hasPermission, Permission } from "@/lib/auth/roles";

async function getAuthUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload) return null;

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { id: true, role: true, status: true, tokenVersion: true },
  });

  if (!user || user.status !== "ACTIVE" || user.tokenVersion !== payload.tokenVersion) return null;
  return user;
}

// GET — list all users (requires MANAGE_USERS permission)
export async function GET() {
  try {
    const authUser = await getAuthUser();
    if (!authUser || !hasPermission(authUser.role, Permission.MANAGE_USERS)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        assignedFarmId: true,
        assignedFarm: { select: { name: true } },
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(users);
  } catch (error) {
    console.error("Failed to fetch users:", error);
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }
}

// PATCH — update a user's role or status (requires MANAGE_USERS permission)
export async function PATCH(request: Request) {
  try {
    const authUser = await getAuthUser();
    if (!authUser || !hasPermission(authUser.role, Permission.MANAGE_USERS)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { id, role, status, assignedFarmId } = await request.json();

    if (!id) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }

    // Prevent self-demotion
    if (id === authUser.id && role && role !== authUser.role) {
      return NextResponse.json({ error: "Cannot change your own role" }, { status: 400 });
    }

    // Prevent deactivating yourself
    if (id === authUser.id && status && status !== "ACTIVE") {
      return NextResponse.json({ error: "Cannot deactivate your own account" }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    if (role !== undefined) updateData.role = role;
    if (status !== undefined) updateData.status = status;
    if (assignedFarmId !== undefined) updateData.assignedFarmId = assignedFarmId;

    // Increment tokenVersion to invalidate existing sessions when role, status, or farm changes
    if (role !== undefined || status !== undefined || assignedFarmId !== undefined) {
      updateData.tokenVersion = { increment: 1 };
    }

    const updated = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        assignedFarmId: true,
        assignedFarm: { select: { name: true } },
        createdAt: true,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update user:", error);
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }
}
