import type { DotGlyphSpec, DotShape, GlyphPath } from "../types.js";
import { clamp, TAU } from "../internal/math.js";

/**
 * A dot is a POLYGON plus two corner radii — not a glyph from a fixed table.
 * Vertices on a unit circle (so `sides: 5` is a pentagon), then:
 *
 *   radius     outer fillet: the convex corners. At radius = the inradius the
 *              polygon is fully rounded and a square becomes a circle, which is the
 *              whole reason this is vertices-and-radius and not a lookup table of
 *              named shapes.
 *   innerRadius fillet on the reflex corners — the notches of a star. A star with
 *              innerRadius 0 is hard-edged; raising it softens the waist, and 0.5
 *              turns the points into teardrops.
 *   spin       rotation, for the 5-point star's upright orientation
 *
 * So a shape is a handful of numbers and every one of them is a slider. Nothing
 * else needs a name.
 */
export const GLYPH_DEFAULTS: DotGlyphSpec = {
  sides: 4,
  radius: 0,
  innerRadius: 0,
  star: 0,
  spin: 0,
  aspect: 1,
};

export type Point = readonly [x: number, y: number];

/**
 * Vertices of an n-gon on the unit circle, optionally with a star's ratio between
 * the points and the notches (star: 0 = plain n-gon, ~0.45 = a classic 5-point star).
 */
export function vertices(g: Partial<DotGlyphSpec>): Point[] {
  const n = Math.max(3, Math.round(g.sides ?? GLYPH_DEFAULTS.sides));
  const star = g.star ?? 0;
  const spin = g.spin ?? 0;
  const aspect = g.aspect ?? 1;
  // an EVEN count is offset by half a step so the vertices land on the axes and
  // `sides: 4` is an axis-aligned square rather than a diamond
  const base = spin - Math.PI / 2 + (n % 2 === 0 ? Math.PI / n : 0);
  const pts: Point[] = [];
  // 2n vertices when starred: the points, then the notches between them
  const count = star > 0 ? n * 2 : n;
  for (let i = 0; i < count; i++) {
    const a = base + (i / count) * TAU;
    const point = i % 2 === 0;
    const r = point ? 1 : star;
    pts.push([Math.cos(a) * r * aspect, Math.sin(a) * r]);
  }
  return pts;
}

/**
 * Fillet a polygon. At each vertex, cut `t = radius / tan(θ/2)` back along both
 * incident edges and bridge the gap with a quadratic through the original corner.
 * `t` is clamped to half the shorter edge, which is what stops a fully-rounded
 * square from inverting at the corners.
 *
 * Reflex vertices (the notches) get `innerRadius` instead, detected by the sign of
 * the cross product against the winding direction.
 */
export function fillet(pts: readonly Point[], radius: number, innerRadius = 0): string {
  const n = pts.length;
  if (n < 3) return "";
  // winding, so we can tell a convex corner from a notch
  let area = 0;
  for (let i = 0; i < n; i++) {
    const a = pts[i]!;
    const b = pts[(i + 1) % n]!;
    area += a[0] * b[1] - b[0] * a[1];
  }
  const ccw = area > 0;
  const parts: { cur: Point; p1: Point; p2: Point; round: boolean }[] = [];
  for (let i = 0; i < n; i++) {
    const prev = pts[(i - 1 + n) % n]!;
    const cur = pts[i]!;
    const next = pts[(i + 1) % n]!;
    const v1: Point = [prev[0] - cur[0], prev[1] - cur[1]];
    const v2: Point = [next[0] - cur[0], next[1] - cur[1]];
    const l1 = Math.hypot(v1[0], v1[1]) || 1;
    const l2 = Math.hypot(v2[0], v2[1]) || 1;
    const u1: Point = [v1[0] / l1, v1[1] / l1];
    const u2: Point = [v2[0] / l2, v2[1] / l2];
    const cosT = clamp(u1[0] * u2[0] + u1[1] * u2[1], -1, 1);
    const theta = Math.acos(cosT); // interior angle at cur
    const cross = v1[0] * v2[1] - v1[1] * v2[0];
    const convex = ccw ? cross < 0 : cross > 0;
    const r = Math.max(0, convex ? radius : innerRadius);
    // reflex corners need a negative tangent to fillet the other side
    const sign = convex ? 1 : -1;
    const denom = Math.tan(theta / 2);
    let t = denom > 1e-6 ? (r * sign) / denom : 0;
    t = clamp(t, -Math.min(l1, l2) / 2, Math.min(l1, l2) / 2);
    parts.push({
      cur,
      p1: [cur[0] + u1[0] * t, cur[1] + u1[1] * t],
      p2: [cur[0] + u2[0] * t, cur[1] + u2[1] * t],
      round: Math.abs(t) > 1e-6,
    });
  }
  let d = "";
  parts.forEach((p, i) => {
    // a space between every pair of numbers: without it "…-1.00000.5000" parses
    // as the single number -1.00000.5
    d += `${i ? "L" : "M"}${p.p1[0].toFixed(4)} ${p.p1[1].toFixed(4)}`;
    if (p.round) {
      d += `Q${p.cur[0].toFixed(4)} ${p.cur[1].toFixed(4)} ${p.p2[0].toFixed(4)} ${p.p2[1].toFixed(4)}`;
    }
  });
  return `${d}Z`;
}

/**
 * The inradius of a vertex list — the radius at which a corner is fully rounded.
 * This is the value that turns a square into a circle, and it is derived rather
 * than tabulated so `sides: 6` behaves the same way.
 */
export function inradius(pts: readonly Point[]): number {
  let min = Infinity;
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const prev = pts[(i - 1 + n) % n]!;
    const cur = pts[i]!;
    const next = pts[(i + 1) % n]!;
    const v1: Point = [prev[0] - cur[0], prev[1] - cur[1]];
    const v2: Point = [next[0] - cur[0], next[1] - cur[1]];
    const l1 = Math.hypot(v1[0], v1[1]) || 1;
    const l2 = Math.hypot(v2[0], v2[1]) || 1;
    const cosT = clamp((v1[0] * v2[0] + v1[1] * v2[1]) / (l1 * l2), -1, 1);
    const t = Math.tan(Math.acos(cosT) / 2);
    if (t > 1e-6) min = Math.min(min, (Math.min(l1, l2) / 2) * t);
  }
  return Number.isFinite(min) ? min : 0;
}

/**
 * The bounding box of a vertex list — the reference the dot is SIZED against.
 *
 * This has to be the box, not the inradius. Normalising by the inradius looks right
 * for a square and is catastrophic for a star: a 5-point star's inradius is ~0.10,
 * so dividing by it inflates the star tenfold and its points overlap their
 * neighbours. Normalising by the box means every glyph occupies exactly `dotSize` —
 * a square tiles its cell, a fully rounded square is the same size (its fillets land
 * on the same tangent points), and a star fits the cell instead of bursting out.
 */
export function bbox(pts: readonly Point[]): number {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of pts) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return Math.max(maxX - minX, maxY - minY) || 1;
}

/**
 * The path for one dot, in units of its own bounding box, centred on the origin.
 * Both renderers consume this, so they can never disagree about the silhouette —
 * which is the reason the CSS renderer is a mask of THIS path rather than a set of
 * hand-written border-radius rules.
 */
export function glyphPath(spec?: Partial<DotGlyphSpec>): GlyphPath {
  const g = { ...GLYPH_DEFAULTS, ...spec };
  const pts = vertices(g);
  return { d: fillet(pts, g.radius, g.innerRadius), inradius: inradius(pts), box: bbox(pts), pts };
}

/**
 * Named starting values over those numbers, so a picker has something to offer.
 * Every one is only a starting value — a caller can overwrite all of them.
 */
export const DOT_SHAPES: Record<
  Exclude<DotShape, "custom">,
  { label: string; spec: Partial<DotGlyphSpec> }
> = {
  square: { label: "Square", spec: { sides: 4, radius: 0, aspect: 1 } },
  rounded: { label: "Rounded", spec: { sides: 4, radius: 0.3, aspect: 1 } },
  circle: { label: "Circle", spec: { sides: 4, radius: 0.5, aspect: 1 } },
  ellipse: { label: "Ellipse", spec: { sides: 4, radius: 0.5, aspect: 0.55 } },
  triangle: { label: "Triangle", spec: { sides: 3, radius: 0, aspect: 1 } },
  diamond: { label: "Diamond", spec: { sides: 4, radius: 0, spin: Math.PI / 4, aspect: 1 } },
  pentagon: { label: "Pentagon", spec: { sides: 5, radius: 0, aspect: 1 } },
  hexagon: { label: "Hexagon", spec: { sides: 6, radius: 0, aspect: 1 } },
  star4: { label: "4-point star", spec: { sides: 4, star: 0.42, innerRadius: 0, aspect: 1 } },
  star5: { label: "5-point star", spec: { sides: 5, star: 0.44, innerRadius: 0, aspect: 1 } },
  star6: { label: "6-point star", spec: { sides: 6, star: 0.4, innerRadius: 0, aspect: 1 } },
  burst: { label: "Soft star", spec: { sides: 5, star: 0.44, innerRadius: 0.16, aspect: 1 } },
  drop: { label: "Teardrop", spec: { sides: 5, star: 0.44, innerRadius: 0.5, aspect: 1 } },
  bar: { label: "Bar", spec: { sides: 4, radius: 0.3, aspect: 0.3 } },
};

export const DOT_SHAPE_KEYS = Object.keys(DOT_SHAPES) as DotShape[];

/**
 * Resolve a named glyph into a polygon spec, or keep the caller's own.
 *
 * 'custom' — and any name this version does not know — falls back to the spec, so
 * a component saved against a newer BotUI keeps working against an older one
 * instead of rendering nothing.
 */
export function specFor(dot: DotShape, spec?: Partial<DotGlyphSpec>): DotGlyphSpec {
  const named = dot === "custom" ? undefined : DOT_SHAPES[dot as Exclude<DotShape, "custom">];
  return { ...GLYPH_DEFAULTS, ...(named?.spec ?? spec) };
}
