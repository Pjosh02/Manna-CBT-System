import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyJWT } from "@/lib/jwt";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Read JWT from cookie
  const tokenCookie = request.cookies.get("token");
  const token = tokenCookie ? tokenCookie.value : null;
  const payload = token ? await verifyJWT(token) : null;

  const isApiRoute = pathname.startsWith("/api");

  // Helper to handle unauthorized requests
  const handleUnauthorized = () => {
    if (isApiRoute) {
      return NextResponse.json(
        { error: "Unauthorized access" },
        { status: 401 }
      );
    }
    return NextResponse.redirect(new URL("/login", request.url));
  };

  // Helper to redirect logged-in users to their respective dashboards
  const getDashboardRedirect = (role: string) => {
    if (role === "ADMIN") return "/admin";
    if (role === "TEACHER") return "/teacher";
    if (role === "STUDENT") return "/student";
    return "/login";
  };

  // If trying to access /login and already logged in, redirect to dashboard
  if (pathname === "/login") {
    if (payload && typeof payload.role === "string") {
      return NextResponse.redirect(new URL(getDashboardRedirect(payload.role), request.url));
    }
    return NextResponse.next();
  };

  // Protect Admin routes
  if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
    if (!payload || payload.role !== "ADMIN") {
      return handleUnauthorized();
    }
  }

  // Protect Teacher routes
  if (pathname.startsWith("/teacher") || pathname.startsWith("/api/teacher")) {
    if (!payload || payload.role !== "TEACHER") {
      return handleUnauthorized();
    }
  }

  // Protect Student routes
  if (pathname.startsWith("/student") || pathname.startsWith("/api/student")) {
    if (!payload || payload.role !== "STUDENT") {
      return handleUnauthorized();
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/login",
    "/admin/:path*",
    "/teacher/:path*",
    "/student/:path*",
    "/api/admin/:path*",
    "/api/teacher/:path*",
    "/api/student/:path*",
  ],
};
