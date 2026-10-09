"use client";

/** Signing out: the server clears the session cookie, then the sign-in page. */

import { useState } from "react";
import { LogOut } from "lucide-react";
import { SIGN_IN_PATH } from "@/lib/auth";

export function SignOutButton() {
  const [leaving, setLeaving] = useState(false);
  const signOut = async () => {
    setLeaving(true);
    await fetch("/api/logout/", { method: "POST" }).catch(() => undefined);
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
