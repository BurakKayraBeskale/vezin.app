import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import { BYPASS_AUTH_ROLES } from "@/lib/auth-bypass";

/** Rol/departman karşılaştırması — büyük/küçük harf bağımsız */
function roleIs(token: any, value: string): boolean {
  return String(token?.role ?? "").toUpperCase() === value.toUpperCase();
}
function deptIs(token: any, value: string): boolean {
  return String((token as any)?.department ?? "").toUpperCase() === value.toUpperCase();
}

export default withAuth(
  function middleware(req) {
    const { token } = req.nextauth;
    const pathname = req.nextUrl.pathname;

    // Force password change — block all non-API page routes until changed
    if (
      token?.mustChangePassword &&
      !pathname.startsWith("/api/") &&
      pathname !== "/change-password"
    ) {
      return NextResponse.redirect(new URL("/change-password", req.url));
    }

    // Admin-only routes
    if (
      !BYPASS_AUTH_ROLES &&
      pathname.startsWith("/admin") &&
      !roleIs(token, "ADMIN")
    ) {
      return NextResponse.redirect(new URL("/", req.url));
    }

    // Beyanname — Admin ve YMM
    if (
      !BYPASS_AUTH_ROLES &&
      pathname.startsWith("/beyanname") &&
      !roleIs(token, "ADMIN") &&
      !deptIs(token, "YEMINLI_MALI_MUSAVIR")
    ) {
      return NextResponse.redirect(new URL("/", req.url));
    }

    // Karşıt İnceleme — sadece Admin, YMM, Muhasebe
    if (
      !BYPASS_AUTH_ROLES &&
      pathname.startsWith("/karsit-inceleme") &&
      !roleIs(token, "ADMIN") &&
      !deptIs(token, "YEMINLI_MALI_MUSAVIR") &&
      !deptIs(token, "MUHASEBE")
    ) {
      return NextResponse.redirect(new URL("/", req.url));
    }
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
);

export const config = {
  matcher: [
    "/((?!api/auth|login|_next/static|_next/image|favicon.ico|.*\\.png|.*\\.jpg|.*\\.svg|.*\\.ico).*)",
  ],
};
