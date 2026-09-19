"use client";

/**
 * Gradient bars: a row of vertical bars rising from the floor of the page,
 * tallest at the edges and lowest in the middle, each breathing on its own
 * offset so the line never pulses as one block.
 *
 * As published, with three changes for this app:
 * - The colours come in as CSS custom properties, so light and dark are set
 *   once in globals.css rather than passed down as props.
 * - `// @ts-ignore` for the custom property is replaced by a typed cast.
 * - A device asking for less motion gets the bars standing still.
 *
 * Only `transform` is animated, which the compositor handles, so it stays
 * cheap on a tablet.
 */

import React from "react";

interface GradientBarsProps {
  numBars?: number;
  gradientFrom?: string;
  gradientTo?: string;
  animationDuration?: number;
  className?: string;
}

export const GradientBars: React.FC<GradientBarsProps> = ({
  numBars = 15,
  gradientFrom = "var(--auth-bar-from, rgb(255, 60, 0))",
  gradientTo = "transparent",
  animationDuration = 2,
  className = "",
}) => {
  const calculateHeight = (index: number, total: number) => {
    const position = index / (total - 1);
    const maxHeight = 100;
    const minHeight = 30;

    const center = 0.5;
    const distanceFromCenter = Math.abs(position - center);
    const heightPercentage = Math.pow(distanceFromCenter * 2, 1.2);

    return minHeight + (maxHeight - minHeight) * heightPercentage;
  };

  return (
    <>
      <style>{`
        @keyframes pulseBar {
          0% { transform: scaleY(var(--initial-scale)); }
          100% { transform: scaleY(calc(var(--initial-scale) * 0.7)); }
        }
        @media (prefers-reduced-motion: reduce) {
          .gradient-bar { animation: none !important; }
        }
      `}</style>

      <div className={`absolute inset-0 z-0 overflow-hidden ${className}`} aria-hidden>
        <div
          className="flex h-full"
          style={{
            width: "100%",
            transform: "translateZ(0)",
            backfaceVisibility: "hidden",
            WebkitFontSmoothing: "antialiased",
          }}
        >
          {Array.from({ length: numBars }).map((_, index) => {
            const height = calculateHeight(index, numBars);
            return (
              <div
                key={index}
                className="gradient-bar"
                style={
                  {
                    flex: `1 0 calc(100% / ${numBars})`,
                    maxWidth: `calc(100% / ${numBars})`,
                    height: "100%",
                    background: `linear-gradient(to top, ${gradientFrom}, ${gradientTo})`,
                    transform: `scaleY(${height / 100})`,
                    transformOrigin: "bottom",
                    transition: "transform 0.5s ease-in-out",
                    animation: `pulseBar ${animationDuration}s ease-in-out infinite alternate`,
                    animationDelay: `${index * 0.1}s`,
                    outline: "1px solid rgba(0, 0, 0, 0)",
                    boxSizing: "border-box",
                    "--initial-scale": height / 100,
                  } as React.CSSProperties
                }
              />
            );
          })}
        </div>
      </div>
    </>
  );
};

interface ComponentProps {
  numBars?: number;
  gradientFrom?: string;
  gradientTo?: string;
  animationDuration?: number;
  backgroundColor?: string;
  children?: React.ReactNode;
}

/** The published wrapper: a full-height section with the bars behind it. */
export default function Component({
  numBars = 7,
  gradientFrom,
  gradientTo = "transparent",
  animationDuration = 2,
  backgroundColor,
  children,
}: ComponentProps) {
  return (
    <section
      className="relative flex min-h-dvh w-full flex-col items-center justify-center overflow-hidden"
      style={backgroundColor ? { backgroundColor } : undefined}
    >
      <GradientBars
        numBars={numBars}
        gradientFrom={gradientFrom}
        gradientTo={gradientTo}
        animationDuration={animationDuration}
      />

      {children && <div className="relative z-10 flex h-full w-full items-center justify-center px-4">{children}</div>}
    </section>
  );
}

export { Component };
