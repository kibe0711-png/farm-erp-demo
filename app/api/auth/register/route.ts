import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { signToken } from "@/lib/jwt";

export async function POST(request: Request) {
  try {
    const { email, name, password } = await request.json();

    if (!email || !name || !password) {
      return NextResponse.json(
        { error: "Email, name, and password are required" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 }
      );
    }

    const hashedPassword = await hashPassword(password);

    // Create user with PENDING status — requires admin approval
    const user = await prisma.user.create({
      data: { email, name, password: hashedPassword, status: "PENDING" },
    });

    // Return success but do NOT issue a token — user must wait for approval
    return NextResponse.json({
      success: true,
      pending: true,
      message: "Registration successful. Your account is pending admin approval.",
      user: { id: user.id, email: user.email, name: user.name },
    });
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json({ error: "Registration failed" }, { status: 500 });
  }
}
