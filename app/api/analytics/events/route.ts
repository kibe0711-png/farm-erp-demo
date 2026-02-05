import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { verifyToken } from "@/lib/jwt";

/**
 * POST /api/analytics/events
 * Records client-side analytics events (page views, actions, etc.)
 *
 * No authentication required - allows tracking failed logins and anonymous usage.
 * If a valid JWT token is present, userId and userRole are extracted.
 *
 * Body: { eventType, eventName, metadata? }
 */
export async function POST(request: Request) {
  try {
    const { eventType, eventName, metadata } = await request.json();

    // Validate required fields
    if (!eventType || !eventName) {
      return NextResponse.json(
        { error: "eventType and eventName are required" },
        { status: 400 }
      );
    }

    // Extract userId and userRole from JWT token if available
    let userId: number | null = null;
    let userRole: string | null = null;

    try {
      const cookieStore = await cookies();
      const token = cookieStore.get("token")?.value;
      if (token) {
        const payload = await verifyToken(token);
        if (payload) {
          userId = payload.userId;
          // Fetch user role from database
          const user = await prisma.user.findUnique({
            where: { id: payload.userId },
            select: { role: true },
          });
          if (user) {
            userRole = user.role;
          }
        }
      }
    } catch {
      // Ignore auth errors - tracking should work even for unauthenticated users
    }

    // Create analytics event
    await prisma.analyticsEvent.create({
      data: {
        eventType,
        eventName,
        userId,
        userRole,
        metadata: metadata || null,
      },
    });

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error("Failed to record analytics event:", error);
    return NextResponse.json(
      { error: "Failed to record analytics event" },
      { status: 500 }
    );
  }
}
