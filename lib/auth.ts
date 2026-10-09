/**
 * Where a signed-out visitor is sent. The lock itself is proxy.ts, which
 * checks the session cookie (lib/session.ts) before serving any page.
 */
export const SIGN_IN_PATH = "/login/";
