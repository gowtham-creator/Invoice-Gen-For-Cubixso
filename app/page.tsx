"use client";

/**
 * The page mounts the workspace in the browser only.
 *
 * Everything the workspace shows starts in localStorage: the draft in
 * progress and the invoices already sent. Rendering it on the server (or at
 * build time, for the static export) would draw a blank invoice that the
 * browser then replaces. Loading it client-side means it reads the draft
 * before its first render, and what appears first is what you left.
 */

import dynamic from "next/dynamic";

const Workspace = dynamic(() => import("@/components/workspace"), {
  ssr: false,
  loading: () => <div className="h-dvh bg-desk" />,
});

export default function Page() {
  return <Workspace />;
}
