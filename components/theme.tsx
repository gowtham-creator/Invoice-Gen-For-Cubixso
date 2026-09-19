"use client";

/**
 * Light, dark and system themes, ported from the Cubixso site
 * (cubixso/src/components/providers/ThemeProvider.tsx and layout/Nav.tsx) so
 * the two behave and look the same.
 *
 * The same contract: the choice is stored under "cubixso.theme", defaults to
 * "system", and while on system it follows the OS live as it flips (macOS at
 * sunset) with no reload. The resolved theme is written to `data-theme` on
 * <html> for the CSS tokens and to `color-scheme` for native controls (date
 * pickers, selects, scrollbars), in one place so the two cannot drift. A boot
 * script in app/layout.tsx does the same before first paint, so there is no
 * flash of the wrong theme.
 */

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";

export type Theme = "light" | "dark" | "system";
type Resolved = "light" | "dark";

/** Shared with the boot script in app/layout.tsx; keep the two in step. */
export const THEME_KEY = "cubixso.theme";

interface ThemeCtxValue {
  theme: Theme;
  resolved: Resolved;
  setTheme: (t: Theme) => void;
  cycle: () => void;
}

const ThemeCtx = createContext<ThemeCtxValue | null>(null);

/**
 * The sign-in page follows the device alone. It has no toggle, so a choice
 * made inside the app must not carry onto it. Mirrored in app/layout.tsx.
 */
const followsDeviceOnly = () => window.location.pathname.startsWith("/login");

function readStored(): Theme {
  if (followsDeviceOnly()) return "system";
  try {
    const v = window.localStorage.getItem(THEME_KEY);
    if (v === "light" || v === "dark" || v === "system") return v;
  } catch {
    /* private mode */
  }
  return "system";
}

function systemPref(): Resolved {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function apply(r: Resolved) {
  const d = document.documentElement;
  d.setAttribute("data-theme", r);
  d.style.colorScheme = r;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Initialised from the DOM the boot script already set, so the first client
  // render agrees with what is on screen.
  const [theme, setThemeState] = useState<Theme>(() => (typeof window === "undefined" ? "system" : readStored()));
  const [resolved, setResolved] = useState<Resolved>(() =>
    typeof document !== "undefined" && document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light",
  );

  useEffect(() => {
    // Follow the OS while on "system". Registered once and gated inside the
    // handler, so switching into "system" later is picked up by it too.
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (readStored() === "system") {
        const r: Resolved = mq.matches ? "dark" : "light";
        setResolved(r);
        apply(r);
      }
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    try {
      window.localStorage.setItem(THEME_KEY, t);
    } catch {
      /* private mode */
    }
    const r: Resolved = t === "system" ? systemPref() : t;
    setResolved(r);
    apply(r);
  }, []);

  // Light -> Dark -> System, as on the site.
  const cycle = useCallback(() => {
    setTheme(theme === "light" ? "dark" : theme === "dark" ? "system" : "light");
  }, [theme, setTheme]);

  return <ThemeCtx.Provider value={{ theme, resolved, setTheme, cycle }}>{children}</ThemeCtx.Provider>;
}

export function useTheme(): ThemeCtxValue {
  const ctx = useContext(ThemeCtx);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}

// The site's own glyphs: stroke on currentColor, so they read on either theme.
const ThemeIcon = (p: React.SVGProps<SVGSVGElement>) => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.7}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
    {...p}
  />
);
const SunGlyph = () => (
  <ThemeIcon>
    <circle cx="12" cy="12" r="4.2" />
    <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.2 5.2l1.4 1.4M17.4 17.4l1.4 1.4M18.8 5.2l-1.4 1.4M6.6 17.4l-1.4 1.4" />
  </ThemeIcon>
);
const MoonGlyph = () => (
  <ThemeIcon>
    <path d="M20 14.2A8.2 8.2 0 0 1 9.8 4 8.4 8.4 0 1 0 20 14.2Z" />
  </ThemeIcon>
);
/** "System" is "follow the device": a display, the universal affordance for it. */
const SystemGlyph = () => (
  <ThemeIcon>
    <rect x="2.5" y="4" width="19" height="12.5" rx="2" />
    <path d="M9 20h6M12 16.5V20" />
  </ThemeIcon>
);

/**
 * One button cycling Light -> Dark -> System, as on the site. The label states
 * the current mode and what the next press does, rather than leaving it to be
 * guessed from an icon; "System" is reachable, so choosing a theme never locks
 * you out of following the device.
 */
export function ThemeToggle() {
  const { theme, resolved, cycle } = useTheme();
  const label = theme === "system" ? `System (currently ${resolved})` : theme === "light" ? "Light" : "Dark";
  const next = theme === "light" ? "Dark" : theme === "dark" ? "System" : "Light";

  return (
    <button
      type="button"
      onClick={cycle}
      aria-label={`Theme: ${label}. Activate for ${next}.`}
      title={`Theme: ${label}. Next: ${next}`}
      className="grid size-8 pointer-coarse:size-10 shrink-0 place-items-center rounded-md text-ink-2 transition-colors duration-150 hover:bg-well hover:text-ink active:bg-line"
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={theme}
          initial={{ opacity: 0, rotate: -90, scale: 0.5 }}
          animate={{ opacity: 1, rotate: 0, scale: 1 }}
          exit={{ opacity: 0, rotate: 90, scale: 0.5 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="grid place-items-center"
        >
          {theme === "light" ? <SunGlyph /> : theme === "dark" ? <MoonGlyph /> : <SystemGlyph />}
        </motion.span>
      </AnimatePresence>
      <span className="sr-only" aria-live="polite">
        {label} theme
      </span>
    </button>
  );
}
