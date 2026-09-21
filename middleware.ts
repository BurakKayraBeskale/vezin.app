import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import { BYPASS_AUTH_ROLES } from "@/lib/auth-bypass";
import { canAccess, isYmmToolPath } from "@/lib/access";

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

    // YMM araçları: yetkiyi sayfa/API canUseYmmTools ile 404 döndürerek uygular
    if (!BYPASS_AUTH_ROLES && !isYmmToolPath(pathname)) {
      const role = String((token as any)?.role ?? "");
      const department = String((token as any)?.department ?? "");

      if (!canAccess(role, department, pathname)) {
        return NextResponse.redirect(new URL("/", req.url));
      }
    }
  },
  {
    callbacks: {
      authorized: ({ token }) => {
        if (!token) return false;
        const status = (token as any).status;
        // Pasif veya silinmiş hesaplar oturum açamaz
        if (status === "INACTIVE" || status === "DELETED") return false;
        return true;
      },
    },
  }
);

export const config = {
  matcher: [
    "/((?!api/auth|login|_next/static|_next/image|favicon.ico|.*\\.png|.*\\.jpg|.*\\.svg|.*\\.ico).*)",
  ],
};
