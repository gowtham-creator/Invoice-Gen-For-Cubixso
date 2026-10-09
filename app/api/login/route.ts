import { NextResponse } from "next/server";
import { SESSION_COOKIE, SESSION_MAX_AGE_S, issueSession, safeEqual } from "@/lib/session";

/**
 * Checks the owner's email and password against OWNER_EMAIL and
 * OWNER_PASSWORD, set as secret environment variables on Vercel, and on a
 * match sets the session cookie the proxy checks. A wrong attempt waits
 * before answering, which slows guessing without a rate limiter.
 */
export async function POST(request: Request) {
  const password = process.env.OWNER_PASSWORD;
  const secret = process.env.AUTH_SECRET;
  if (!password || !secret) return NextResponse.json({ error: "not-configured" }, { status: 503 });

  const body = (await request.json().catch(() => ({}))) as { email?: unknown; password?: unknown };
  const owner = (process.env.OWNER_EMAIL ?? "gowtham@cubixso.com").trim().toLowerCase();
  const emailOk = safeEqual(String(body.email ?? "").trim().toLowerCase(), owner);
  const passwordOk = safeEqual(String(body.password ?? ""), password);
  if (!(emailOk && passwordOk)) {
    await new Promise((r) => setTimeout(r, 800));
    return NextResponse.json({ error: "invalid" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, await issueSession(secret), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_S,
  });
  return res;
}
