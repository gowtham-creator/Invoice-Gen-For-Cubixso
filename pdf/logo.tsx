/**
 * The Cubixso mark, drawn as vectors.
 *
 * Rebuilt as geometry rather than embedded as the source PNG so it stays sharp
 * at any size, prints crisp, and can take the document's accent colour. The
 * mark is an isometric cube: a pointy-top hexagon for the silhouette, plus the
 * three edges meeting at the cube's front corner — the "Y" in the middle.
 *
 * Every stroke stops short of its corner. Those gaps are what give the original
 * its cut, constructed look instead of a closed outline, so they are part of
 * the mark rather than a rendering artefact.
 */

import { Svg, Path, G } from "@react-pdf/renderer";

/** Point `t` of the way from `a` to `b`. */
function lerp(a: [number, number], b: [number, number], t: number): [number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

export function CubixsoMark({ size = 26, color = "#1d1d1f" }: { size?: number; color?: string }) {
  const c = size / 2;
  // Inset by half the stroke so the mark is never clipped by the viewBox edge.
  const stroke = size * 0.105;
  const r = c - stroke / 2;

  // Pointy-top hexagon. SVG y grows downward, hence the sign flip on sin.
  const vertex = (deg: number): [number, number] => {
    const a = (deg * Math.PI) / 180;
    return [c + r * Math.cos(a), c - r * Math.sin(a)];
  };
  const top = vertex(90);
  const ur = vertex(30);
  const lr = vertex(-30);
  const bot = vertex(-90);
  const ll = vertex(-150);
  const ul = vertex(150);
  const mid: [number, number] = [c, c];

  const f = (n: number) => n.toFixed(2);
  /** A line from `a` to `b`, trimmed by `g0`/`g1` at each end. */
  const seg = (a: [number, number], b: [number, number], g0: number, g1: number) => {
    const p = lerp(a, b, g0);
    const q = lerp(a, b, 1 - g1);
    return `M ${f(p[0])} ${f(p[1])} L ${f(q[0])} ${f(q[1])}`;
  };

  const GAP = 0.06;
  const outline = [
    seg(ul, top, GAP, GAP),
    seg(top, ur, GAP, GAP),
    seg(ur, lr, GAP, GAP),
    seg(lr, bot, GAP, GAP),
    seg(bot, ll, GAP, GAP),
    seg(ll, ul, GAP, GAP),
  ];

  // The three cube edges meeting at the front corner. They stop well short of
  // the silhouette, which is what reads as depth rather than as a wheel.
  const spokes = [
    seg(mid, ul, 0.04, 0.3),
    seg(mid, ur, 0.04, 0.3),
    seg(mid, bot, 0.04, 0.12),
  ];

  const common = {
    stroke: color,
    strokeWidth: stroke,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    fill: "none",
  };

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <G>
        {[...outline, ...spokes].map((d, i) => (
          <Path key={i} d={d} {...common} />
        ))}
      </G>
    </Svg>
  );
}
