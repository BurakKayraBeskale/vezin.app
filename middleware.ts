import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

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
      pathname.startsWith("/admin") &&
      token?.role !== "ADMIN"
    ) {
      return NextResponse.redirect(new URL("/", req.url));
    }

    // Beyanname — GEÇİCİ: tüm giriş yapmış kullanıcılara açık
    // TODO: Aşağıdaki bloğu uncomment ederek Admin+YMM kısıtına geri dön
    // if (
    //   pathname.startsWith("/beyanname") &&
    //   token?.role !== "ADMIN" &&
    //   (token as any)?.department !== "YEMINLI_MALI_MUSAVIR"
    // ) {
    //   return NextResponse.redirect(new URL("/", req.url));
    // }

    // Karşıt İnceleme — sadece Admin, YMM, Muhasebe
    if (
      pathname.startsWith("/karsit-inceleme") &&
      token?.role !== "ADMIN" &&
      (token as any)?.department !== "YEMINLI_MALI_MUSAVIR" &&
      (token as any)?.department !== "MUHASEBE"
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
