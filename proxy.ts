import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const isAuthenticated = request.cookies.get("auth")?.value === "true";
  const isLoginPage = request.nextUrl.pathname === "/";
  const isApiAuth = request.nextUrl.pathname === "/api/auth";

  if (isApiAuth) {
    return NextResponse.next();
  }

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
