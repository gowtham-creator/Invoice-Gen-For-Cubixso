"use client";

/**
 * The signed-in session, seen from inside the app.
 *
 * The CDN checks the session cookie on every page load, and its token lasts
 * an hour. Identity renews it on a timer once the browser session is loaded,
 * but a laptop asleep overnight misses the timer, so the app also renews it
 * whenever the tab comes back into view. A reload then never lands on the
 * sign-in page mid-work.
 */

import { useEffect, useState } from "react";
import { LogOut } from "lucide-react";
import { getUser, logout, refreshSession } from "@netlify/identity";
import { SIGN_IN_PATH } from "@/lib/auth";

export function useKeepSessionAlive() {
  useEffect(() => {
    // Loading the user starts Identity's own refresh timer. It never throws,
    // and off Netlify (local builds) it simply finds no one.
    void getUser();
    const onVisible = () => {
      if (document.visibilityState === "visible") void refreshSession().catch(() => null);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);
}

export function SignOutButton() {
  const [leaving, setLeaving] = useState(false);
  const signOut = async () => {
    setLeaving(true);
    try {
      await logout();
    } catch {
      // Already signed out, or Identity unreachable: the sign-in page is
      // still the right place to go, and the CDN will not let the app back
      // in without a live session.
    }
    window.location.replace(SIGN_IN_PATH);
  };
  return (
    <button
      type="button"
      onClick={signOut}
      disabled={leaving}
      aria-label="Sign out"
      title="Sign out"
      className="grid size-8 pointer-coarse:size-10 shrink-0 place-items-center rounded-md text-ink-2 transition-colors duration-150 hover:bg-well hover:text-ink active:bg-line disabled:opacity-50"
    >
      <LogOut size={15} strokeWidth={1.8} aria-hidden />
    </button>
  );
}
