import type { Metadata } from "next";
import { SignIn } from "@/components/sign-in";

/**
 * The one page the CDN serves to a signed-out visitor (see netlify.toml). It
 * follows the device's light or dark setting only and has no theme toggle;
 * the toggle is inside the app, after signing in.
 */
export const metadata: Metadata = {
  title: "Sign in · Cubixso Invoices",
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return <SignIn />;
}
