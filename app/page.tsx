"use client";

/**
 * The page mounts the app in the browser only.
 *
 * Everything the app shows lives in localStorage: the invoices you have made.
 * Rendering it on the server (or at build time, for the static export) would
 * draw an empty list that the browser then replaces. Loading it client-side
 * means the first thing drawn is your own invoices.
 */

import dynamic from "next/dynamic";

const App = dynamic(() => import("@/components/app"), {
  ssr: false,
  loading: () => <div className="h-dvh bg-desk" />,
});

export default function Page() {
  return <App />;
}
