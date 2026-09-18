"use client";

/**
 * Screens addressed by the URL hash: "#/" is the invoice list,
 * "#/invoice/<id>" the editor, "#/invoice/<id>/preview" the preview.
 *
 * A hash rather than real routes because the site is a static export and
 * invoices live in the browser: there is nothing on the server for
 * "/invoice/<id>" to resolve to. Hash navigation still gives back and forward,
 * refresh, and links that reopen an invoice.
 */

import { useCallback, useEffect, useState } from "react";

export type Route = { name: "home" } | { name: "invoice"; id: string } | { name: "preview"; id: string };

export function parseHash(hash: string): Route {
  const m = /^#\/invoice\/([^/]+)(\/preview)?\/?$/.exec(hash);
  if (m) return m[2] ? { name: "preview", id: decodeURIComponent(m[1]) } : { name: "invoice", id: decodeURIComponent(m[1]) };
  return { name: "home" };
}

export function hrefFor(route: Route): string {
  if (route.name === "home") return "#/";
  const base = `#/invoice/${encodeURIComponent(route.id)}`;
  return route.name === "preview" ? `${base}/preview` : base;
}

/** In-app navigations this session, so "back" never walks off the site. */
let depth = 0;

export function useRoute(): [Route, (r: Route) => void, () => void] {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));

  useEffect(() => {
    const on = () => setRoute(parseHash(window.location.hash));
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);

  const go = useCallback((r: Route) => {
    depth += 1;
    window.location.hash = hrefFor(r);
  }, []);

  /** Back to wherever the user came from; home if they arrived here directly. */
  const back = useCallback(() => {
    if (depth > 0) {
      depth -= 1;
      window.history.back();
    } else {
      window.location.hash = hrefFor({ name: "home" });
    }
  }, []);

  return [route, go, back];
}
