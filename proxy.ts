import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyToken } from "@/lib/jwt";

export async function proxy(request: NextRequest) {
  const token = request.cookies.get("token")?.value;
  const pathname = request.nextUrl.pathname;

  const isLoginPage = pathname === "/";
  const isRegisterPage = pathname === "/register";
  const isAuthApi = pathname.startsWith("/api/auth");

  // Always allow auth APIs and register page
  if (isAuthApi || isRegisterPage) {
    return NextResponse.next();
  }

  const payload = token ? await verifyToken(token) : null;
  const isAuthenticated = payload !== null;

  if (!isAuthenticated && !isLoginPage) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (isAuthenticated && isLoginPage) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
