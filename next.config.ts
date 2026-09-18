import type { NextConfig } from "next";

/**
 * Built as a static export.
 *
 * The whole app runs in the browser: the editor holds its state in React, the
 * PDF is rendered client-side by @react-pdf/renderer, and drafts persist to
 * localStorage. There is no server route, no data fetching and nothing to
 * render on a server, so shipping serverless functions would add moving parts
 * that do no work.
 *
 * A static export is also the most robust thing to hand a CDN — plain files,
 * no runtime version to drift, nothing to cold-start.
 */
const nextConfig: NextConfig = {
  output: "export",

  // The export has no server to run the image optimiser. The app uses plain
  // <img> for the signature preview rather than next/image, so this only
  // guards against a future import reintroducing the dependency.
  images: { unoptimized: true },

  // Emit `/path/index.html` instead of `/path.html`, which is what static hosts
  // expect when serving a directory URL.
  trailingSlash: true,
};

export default nextConfig;
