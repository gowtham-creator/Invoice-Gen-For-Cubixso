/**
 * Who Netlify Identity may create an account for, and what that account is
 * allowed to do. Netlify calls this function on every signup and sign-in.
 *
 * Two jobs:
 * - Only the owner's address can hold an account. Registration is open on
 *   the site, so without this anyone could sign up; they would still not get
 *   past the CDN (netlify.toml admits the "owner" role alone), but there is
 *   no reason to let strangers create accounts at all.
 * - The owner's account is given the "owner" role automatically, so the role
 *   never has to be typed into the dashboard by hand.
 *
 * The address can be changed without a deploy by setting an OWNER_EMAIL
 * environment variable on the site.
 */

import type { UserLoginEvent, UserSignupEvent, UserValidateEvent } from "@netlify/functions";

const OWNER_EMAIL = (process.env.OWNER_EMAIL ?? "gowtham@cubixso.com").trim().toLowerCase();

/** Matches OWNER_ROLE in lib/auth.ts and the Role condition in netlify.toml. */
const OWNER_ROLE = "owner";

const isOwner = (email?: string) => (email ?? "").trim().toLowerCase() === OWNER_EMAIL;

const rolesOf = (appMetadata: Record<string, unknown> | undefined): string[] => {
  const roles = appMetadata?.roles;
  return Array.isArray(roles) ? roles.filter((r): r is string => typeof r === "string") : [];
};

const withOwnerRole = (user: UserSignupEvent["user"]) => ({
  user: {
    ...user,
    appMetadata: { ...user.appMetadata, roles: [...new Set([...rolesOf(user.appMetadata), OWNER_ROLE])] },
  },
});

const handlers = {
  userValidate(event: UserValidateEvent) {
    if (!isOwner(event.user.email)) return event.deny();
  },

  userSignup(event: UserSignupEvent) {
    if (!isOwner(event.user.email)) return event.deny();
    return withOwnerRole(event.user);
  },

  // A safety net: an account made before this function existed, or one whose
  // invite was accepted without the signup event firing, is given the role on
  // its next sign-in rather than needing the dashboard. Sign-in is not denied
  // here: an account made earlier under another address keeps working if it
  // already holds the role, and the CDN still admits the role alone.
  userLogin(event: UserLoginEvent) {
    if (!isOwner(event.user.email) || rolesOf(event.user.appMetadata).includes(OWNER_ROLE)) return;
    return withOwnerRole(event.user);
  },
};

export default handlers;
