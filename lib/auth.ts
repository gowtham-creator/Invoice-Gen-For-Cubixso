/**
 * Who may use the invoicer: one Netlify Identity account holding the owner
 * role. The lock itself is not in this file. It is the redirect rules in
 * netlify.toml, which Netlify's CDN checks against the signed nf_jwt cookie
 * before serving any page, so the app never reaches a browser that has not
 * signed in. Everything here only makes signing in pleasant.
 */

import type { User } from "@netlify/identity";

/** The role the CDN admits. It must match `conditions = {Role = [...]}` in netlify.toml. */
export const OWNER_ROLE = "owner";

export const SIGN_IN_PATH = "/login/";

export const isOwner = (user: User | null | undefined): boolean => !!user?.roles?.includes(OWNER_ROLE);
