import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { verifyToken } from "@/lib/jwt";

/**
 * POST /api/auth/logout
 * Updates UserSession with logout time and duration
 * Tracks logout analytics event
 */
export async function POST() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;

    if (!token) {
      return NextResponse.json({ success: true }, { status: 200 });
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json({ success: true }, { status: 200 });
    }

    const { userId, sessionId } = payload;

    // Update session with logout time and calculate duration
    if (sessionId) {
      const session = await prisma.userSession.findUnique({
        where: { id: sessionId },
        select: { loginAt: true },
      });

      if (session) {
        const logoutAt = new Date();
        const duration = Math.floor((logoutAt.getTime() - session.loginAt.getTime()) / 1000);

        await prisma.userSession.update({
          where: { id: sessionId },
          data: {
            logoutAt,
            duration,
          },
        }).catch(() => {
          // Silently fail if session update fails
        });
      }
    }

    // Track logout event
    await prisma.analyticsEvent.create({
      data: {
        eventType: "logout",
        eventName: "logout",
        userId,
        userRole: null, // Will be fetched from user record if needed
        metadata: { sessionId },
      },
    }).catch(() => {
      // Silently fail if analytics logging fails
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Logout tracking error:", error);
    return NextResponse.json({ success: true }, { status: 200 }); // Don't fail logout
  }
}
