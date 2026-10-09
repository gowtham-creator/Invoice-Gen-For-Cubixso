/**
 * The owner's session: a cookie holding an expiry time and an HMAC of it,
 * signed with AUTH_SECRET. Nothing about the user is stored; a valid signature
 * on an unexpired time is the whole proof of having signed in. Web Crypto
 * only, so it runs in the proxy and in route handlers alike.
 */

export const SESSION_COOKIE = "cx_session";
export const SESSION_MAX_AGE_S = 60 * 60 * 24 * 30;

const enc = new TextEncoder();

async function hmac(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(data)));
  return btoa(String.fromCharCode(...sig)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Compares in time that does not depend on where the strings first differ. */
export function safeEqual(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

export async function issueSession(secret: string): Promise<string> {
  const expires = String(Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_S);
  return `${expires}.${await hmac(secret, expires)}`;
}

export async function verifySession(value: string | undefined, secret: string | undefined): Promise<boolean> {
  if (!value || !secret) return false;
  const [expires, sig] = value.split(".");
  if (!expires || !sig || Number(expires) < Date.now() / 1000) return false;
  return safeEqual(sig, await hmac(secret, expires));
}
