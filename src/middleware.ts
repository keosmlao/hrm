import { NextRequest, NextResponse } from "next/server";
import { getPublicUrl } from "@/lib/public-url";

const publicPaths = [
  "/login",
  "/api/auth",
  "/manifest.webmanifest",
  "/sw.js",
  "/offline.html",
  "/pwa-icon",
];

export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  const session = request.cookies.get("session");
  const hasAuthError = searchParams.has("error");
  const skipAutoLogin = searchParams.get("manual") === "1";

  if (pathname === "/login") {
    if (session) {
      return NextResponse.redirect(getPublicUrl(request, "/home"));
    }

    if (!hasAuthError && !skipAutoLogin) {
      return NextResponse.redirect(getPublicUrl(request, "/api/auth/line"));
    }
  }

  // Allow public paths
  if (publicPaths.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Check for session cookie
  if (!session) {
    return NextResponse.redirect(getPublicUrl(request, "/login"));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico (favicon)
     * - public files (images, etc.)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
