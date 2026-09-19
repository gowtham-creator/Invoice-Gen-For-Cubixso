"use client";

/**
 * The sign-in page's behaviour: Netlify Identity behind the AuthForm design.
 *
 * Identity's emails all link to the site root with a token in the hash. A
 * signed-out visitor's request for "/" is redirected here by the CDN, and a
 * browser carries the hash across a redirect, so this page is where every
 * token lands: invites, password resets and confirmations.
 */

import { useCallback, useEffect, useState } from "react";
import {
  AuthError,
  MissingIdentityError,
  acceptInvite,
  getUser,
  handleAuthCallback,
  login,
  logout,
  refreshSession,
  requestPasswordRecovery,
  updateUser,
  type User,
} from "@netlify/identity";
import AuthForm, { type AuthMode } from "@/components/ui/auth-form";
import { OWNER_ROLE, isOwner } from "@/lib/auth";

/**
 * When this page last sent the browser into the app. If the CDN refuses the
 * session it sends the browser straight back here, and handing it over again
 * would loop forever, so a return within a few seconds stops and says so.
 */
const HANDOFF_KEY = "cubixso.auth.handoff";
const LOOP_WINDOW_MS = 15_000;

function recentlyHandedOff(): boolean {
  try {
    return Date.now() - Number(window.sessionStorage.getItem(HANDOFF_KEY) ?? 0) < LOOP_WINDOW_MS;
  } catch {
    return false;
  }
}

function enterApp() {
  try {
    window.sessionStorage.setItem(HANDOFF_KEY, String(Date.now()));
  } catch {
    /* private mode: the loop guard is lost, nothing else */
  }
  window.location.replace("/");
}

/** Identity's errors, said in the terms of this page. */
function explain(e: unknown): string {
  if (e instanceof MissingIdentityError) {
    return "Sign-in is not switched on for this site yet. Enable Netlify Identity for it, then try again.";
  }
  if (e instanceof AuthError) {
    // No Identity service answering at /.netlify/identity: it is not enabled
    // on this site, or this is a local build with no Netlify in front of it.
    if (e.status === 404 || e.status === 405 || e.status === 501) {
      return "Sign-in is not switched on for this site yet. Enable Netlify Identity for it, then try again.";
    }
    if (e.status === 429) return "Too many attempts. Wait a minute, then try again.";
    const m = e.message.toLowerCase();
    if (m.includes("invalid") && (m.includes("password") || m.includes("grant") || m.includes("credentials"))) {
      return "That email and password do not match.";
    }
    if (m.includes("not confirmed")) return "Confirm your email first: open the link Netlify sent you.";
    if (m.includes("expired")) return "That link has expired. Ask for a new one.";
    return e.message;
  }
  if (e instanceof TypeError) return "Could not reach the sign-in service. Check your connection and try again.";
  return e instanceof Error ? e.message : String(e);
}

export function SignIn() {
  const [mode, setMode] = useState<AuthMode>("sign-in");
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [inviteToken, setInviteToken] = useState<string | null>(null);

  /** Lets the owner through; turns anyone else away with the reason. */
  const admit = useCallback(async (user: User, automatic: boolean) => {
    if (!isOwner(user)) {
      await logout().catch(() => {});
      setError(
        `${user.email ?? "This account"} does not have the "${OWNER_ROLE}" role, so it cannot open the invoicer. ` +
          `Give it the role in Netlify under Identity, then sign in again.`,
      );
      return false;
    }
    if (automatic && recentlyHandedOff()) {
      // Signed in, but the CDN sent the browser back: its cookie is stale or
      // was never set. A fresh sign-in writes a new one.
      await logout().catch(() => {});
      setError("Your session could not be confirmed. Sign in again to continue.");
      return false;
    }
    // The CDN reads the cookie, so make sure it holds a live token first.
    await refreshSession().catch(() => null);
    enterApp();
    return true;
  }, []);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const callback = await handleAuthCallback();
        if (!live) return;
        if (callback?.type === "invite" && callback.token) {
          setInviteToken(callback.token);
          setMode("set-password");
          return;
        }
        if (callback?.type === "recovery") {
          setMode("reset-password");
          return;
        }
        const user = callback?.user ?? (await getUser());
        if (live && user) await admit(user, true);
      } catch (e) {
        if (live) setError(explain(e));
      } finally {
        if (live) setChecking(false);
      }
    })();
    return () => {
      live = false;
    };
  }, [admit]);

  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await work();
    } catch (e) {
      setError(explain(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthForm
      mode={mode}
      busy={busy}
      checking={checking}
      error={error}
      notice={notice}
      onSignIn={(email, password) =>
        run(async () => {
          await admit(await login(email, password), false);
        })
      }
      onSetPassword={(password) =>
        run(async () => {
          const user = mode === "set-password" && inviteToken
            ? await acceptInvite(inviteToken, password)
            : await updateUser({ password });
          await admit(user, false);
        })
      }
      onForgot={(email) =>
        run(async () => {
          await requestPasswordRecovery(email);
          setNotice("If that is the owner's address, a reset link is on its way. Open it on this device.");
        })
      }
    />
  );
}
