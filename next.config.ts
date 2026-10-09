import type { NextConfig } from "next";

/**
 * The app runs in the browser: the editor holds its state in React, the PDF is
 * rendered client-side, and invoices persist to localStorage. The one server
 * piece is the sign-in lock (proxy.ts and app/api/login), which is why this is
 * a regular Next.js build on Vercel rather than a static export.
 */
const nextConfig: NextConfig = {
  // The export has no server to run the image optimiser. The app uses plain
  // <img> for the signature preview rather than next/image, so this only
  // guards against a future import reintroducing the dependency.
  images: { unoptimized: true },

  // Emit `/path/index.html` instead of `/path.html`, which is what static hosts
  // expect when serving a directory URL.
  trailingSlash: true,
};

export default nextConfig;
