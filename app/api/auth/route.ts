import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/auth";
import { signToken } from "@/lib/jwt";

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !(await verifyPassword(password, user.password))) {
      // Track failed login attempt
      await prisma.analyticsEvent.create({
        data: {
          eventType: "login",
          eventName: "login_failed",
          userId: null,
          userRole: null,
          metadata: { email },
        },
      }).catch(() => {
        // Silently fail if analytics logging fails
      });

      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    if (user.status === "PENDING") {
      return NextResponse.json(
        { error: "Your account is pending admin approval.", pending: true },
        { status: 403 }
      );
    }

    if (user.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "Account is not active. Contact your administrator." },
        { status: 403 }
      );
    }

    // Extract IP address and user agent
    const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0] ||
                      request.headers.get("x-real-ip") ||
                      "unknown";
    const userAgent = request.headers.get("user-agent") || null;

    // Create user session record
    const session = await prisma.userSession.create({
      data: {
        userId: user.id,
        loginAt: new Date(),
        ipAddress,
        userAgent,
      },
    }).catch(() => null); // Don't fail login if session tracking fails

    // Track successful login event
    await prisma.analyticsEvent.create({
      data: {
        eventType: "login",
        eventName: "login_success",
        userId: user.id,
        userRole: user.role,
        metadata: { sessionId: session?.id },
      },
    }).catch(() => {
      // Silently fail if analytics logging fails
    });

    const token = await signToken({
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      tokenVersion: user.tokenVersion,
      sessionId: session?.id, // Include session ID in token for logout tracking
    });

    const response = NextResponse.json({
      success: true,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });

    response.cookies.set("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.set("token", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
  return response;
}
