"use client";

/**
 * The sign-in page's behaviour: the AuthForm design in front of /api/login,
 * which checks the owner's email and password and sets the session cookie the
 * proxy requires. There is one account, so there are no invites or reset
 * emails: the password is an environment variable on Vercel.
 */

import { useState } from "react";
import AuthForm from "@/components/ui/auth-form";

export function SignIn() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const signIn = async (email: string, password: string) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/login/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (res.ok) {
        window.location.replace("/");
        return;
      }
      setError(
        res.status === 401
          ? "That email and password do not match."
          : res.status === 503
            ? "Sign-in is not set up yet: OWNER_PASSWORD and AUTH_SECRET must be set on Vercel."
            : `Sign-in failed (${res.status}). Try again.`,
      );
    } catch {
      setError("Could not reach the sign-in service. Check your connection and try again.");
    }
    setBusy(false);
  };

  return (
    <AuthForm
      mode="sign-in"
      busy={busy}
      error={error}
      notice={notice}
      onSignIn={signIn}
      onSetPassword={() => undefined}
      onForgot={() =>
        setNotice(
          "The password is OWNER_PASSWORD in Vercel → Project → Settings → Environment Variables. Change it there and redeploy.",
        )
      }
    />
  );
}
