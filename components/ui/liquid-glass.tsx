"use client";

/**
 * Apple-style liquid glass, built from a blurred backdrop and one SVG
 * displacement filter. No dependency, no per-frame work: the filter is
 * defined once and the browser composites it.
 *
 * As published, with three changes:
 * - `rounded-inherit` is not a utility, so the layers never followed the
 *   wrapper's corners; they use `rounded-[inherit]` now and the hard-coded
 *   `rounded-3xl` on the layers is gone, so any radius works.
 * - The filter id is exported, and `<GlassFilter />` is rendered once per
 *   page rather than by each pane.
 * - The demo dock of Mac icons is left out: it pulls six images from a CDN
 *   and has nothing to do with this app. GlassDock and GlassButton stay, so
 *   it can be rebuilt anywhere with local icons.
 */

import React from "react";

export const GLASS_FILTER_ID = "glass-distortion";

interface GlassEffectProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  href?: string;
  target?: string;
}

interface DockIcon {
  src: string;
  alt: string;
  onClick?: () => void;
}

/** A pane of glass. Give it its own radius and padding through `className`. */
export const GlassEffect: React.FC<GlassEffectProps> = ({
  children,
  className = "",
  style = {},
  href,
  target = "_blank",
}) => {
  const glassStyle = {
    boxShadow: "0 6px 6px rgba(0, 0, 0, 0.2), 0 0 20px rgba(0, 0, 0, 0.1)",
    transitionTimingFunction: "cubic-bezier(0.175, 0.885, 0.32, 2.2)",
    ...style,
  };

  const content = (
    <div className={`relative flex overflow-hidden transition-all duration-700 ${className}`} style={glassStyle}>
      {/* The backdrop, blurred and then pushed about by the filter. */}
      <div
        className="absolute inset-0 z-0 overflow-hidden rounded-[inherit]"
        style={{
          backdropFilter: "blur(3px)",
          filter: `url(#${GLASS_FILTER_ID})`,
          isolation: "isolate",
        }}
      />
      {/* The milky body of the glass. */}
      <div className="absolute inset-0 z-10 rounded-[inherit]" style={{ background: "rgba(255, 255, 255, 0.25)" }} />
      {/* The lit bevel, brighter at the top left as though lit from there. */}
      <div
        className="absolute inset-0 z-20 overflow-hidden rounded-[inherit]"
        style={{
          boxShadow:
            "inset 2px 2px 1px 0 rgba(255, 255, 255, 0.5), inset -1px -1px 1px 1px rgba(255, 255, 255, 0.5)",
        }}
      />

      <div className="relative z-30 w-full">{children}</div>
    </div>
  );

  return href ? (
    <a href={href} target={target} rel="noopener noreferrer" className="block">
      {content}
    </a>
  ) : (
    content
  );
};

/** A row of icons on one pane, the Mac dock shape. */
export const GlassDock: React.FC<{ icons: DockIcon[]; href?: string }> = ({ icons, href }) => (
  <GlassEffect href={href} className="rounded-3xl p-3 font-semibold text-black hover:rounded-4xl hover:p-4">
    <div className="flex items-center justify-center gap-2 overflow-hidden rounded-3xl px-0.5 py-0">
      {icons.map((icon, index) => (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          key={index}
          src={icon.src}
          alt={icon.alt}
          className="h-16 w-16 cursor-pointer transition-all duration-700 hover:scale-110"
          style={{
            transformOrigin: "center center",
            transitionTimingFunction: "cubic-bezier(0.175, 0.885, 0.32, 2.2)",
          }}
          onClick={icon.onClick}
        />
      ))}
    </div>
  </GlassEffect>
);

/** A glass button that swells a little as the pointer rests on it. */
export const GlassButton: React.FC<{ children: React.ReactNode; href?: string }> = ({ children, href }) => (
  <GlassEffect
    href={href}
    className="cursor-pointer overflow-hidden rounded-3xl px-10 py-6 font-semibold text-black hover:rounded-4xl hover:px-11 hover:py-7"
  >
    <div
      className="transition-all duration-700 hover:scale-95"
      style={{ transitionTimingFunction: "cubic-bezier(0.175, 0.885, 0.32, 2.2)" }}
    >
      {children}
    </div>
  </GlassEffect>
);

/**
 * The filter every pane points at: fractal noise, softened, lit from the top
 * left, then used to displace whatever is behind the glass. Render it once
 * per page, anywhere.
 */
export const GlassFilter: React.FC = () => (
  <svg style={{ display: "none" }} aria-hidden>
    <filter id={GLASS_FILTER_ID} x="0%" y="0%" width="100%" height="100%" filterUnits="objectBoundingBox">
      <feTurbulence type="fractalNoise" baseFrequency="0.001 0.005" numOctaves="1" seed="17" result="turbulence" />
      <feComponentTransfer in="turbulence" result="mapped">
        <feFuncR type="gamma" amplitude="1" exponent="10" offset="0.5" />
        <feFuncG type="gamma" amplitude="0" exponent="1" offset="0" />
        <feFuncB type="gamma" amplitude="0" exponent="1" offset="0.5" />
      </feComponentTransfer>
      <feGaussianBlur in="turbulence" stdDeviation="3" result="softMap" />
      <feSpecularLighting
        in="softMap"
        surfaceScale="5"
        specularConstant="1"
        specularExponent="100"
        lightingColor="white"
        result="specLight"
      >
        <fePointLight x="-200" y="-200" z="300" />
      </feSpecularLighting>
      <feComposite in="specLight" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" result="litImage" />
      <feDisplacementMap in="SourceGraphic" in2="softMap" scale="200" xChannelSelector="R" yChannelSelector="G" />
    </filter>
  </svg>
);
