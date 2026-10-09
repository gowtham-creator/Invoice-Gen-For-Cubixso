import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

/**
 * The lock: every page is served only to a browser holding a valid session
 * cookie (lib/session.ts); anyone else is sent to the sign-in page. The
 * sign-in page, its API, the compiled code and the invoice artwork stay open.
 * The code holds no invoices (those live in the owner's browser), and the
 * artwork is already public in the repository.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/login") || pathname.startsWith("/api/login") || pathname.startsWith("/api/logout")) {
    return NextResponse.next();
  }
  if (await verifySession(request.cookies.get(SESSION_COOKIE)?.value, process.env.AUTH_SECRET)) {
    return NextResponse.next();
  }
  return NextResponse.redirect(new URL("/login/", request.url));
}

export const config = {
  matcher: ["/((?!_next/|fonts/|.*\\.(?:png|ico|svg|ttf|txt|webmanifest)$).*)"],
};
