import type { DotMatrixLayout, DotMatrixOptions, ResolvedDotMatrixOptions } from "../types.js";
import { clamp } from "../internal/math.js";
import { GLYPH_DEFAULTS } from "./glyph.js";

/**
 * The defaults, and the only place a new option acquires a default.
 */
export const DEFAULTS = {
  /**
   * size — the component's box, in px, the way an icon component takes a size. It
   * is the ONLY length in the public vocabulary: everything else is a fraction of
   * it, so a field at 16 and the same field at 240 are the same drawing at two
   * scales.
   */
  size: 240,
  cols: 7,
  rows: 7,
  fill: 1, // share of the box the field's centre span takes (1 = fills it)
  silhouette: "circle",
  dot: "square",
  /** the dot's footprint as a FRACTION OF ITS CELL; above 1 the dots touch */
  dotSize: 0.55,
  /** the space BETWEEN cells, as a multiple of the cell, per axis independently */
  gapX: 0.45,
  gapY: 0.45,
  preset: "spiral",
  floor: 0.16,
  peak: 1,
  speed: 1,
  grow: 0.5, // 0 = fixed size (an LED panel), 1 = full breath
  /** null = "use the preset's own stagger" */
  stagger: null,
  /** how much longer the wave's own ramp is; see `softLevel` */
  softness: 0,
  color: "currentColor",
  spec: { ...GLYPH_DEFAULTS },
  renderer: "svg",
  reducedMotion: false,
} as const satisfies Omit<ResolvedDotMatrixOptions, "stagger"> & { stagger: null };

export type DotMatrixDefaultOptions = typeof DEFAULTS;

/** fill in every option, so the rest of the library never has to */
export function resolveOptions(options: DotMatrixOptions = {}): ResolvedDotMatrixOptions {
  return {
    ...DEFAULTS,
    ...options,
    spec: { ...DEFAULTS.spec, ...options.spec },
    stagger: options.stagger ?? null,
  };
}

/**
 * The geometry, in PX, for a field of the given `size` — the one computation both
 * renderers use.
 *
 * The size algebra is the whole design. Let `f` be dotSize (the dot's share of its
 * cell), `g` the gap (a multiple of the cell) and `n` the count on that axis. A cell
 * of size `c` gives a pitch of `c(1 + g)`, so:
 *
 *     centre span = (n - 1) · c(1 + g)     distance between the outer centres
 *     dot         = f · c
 *     size        = centre span + dot      the field exactly fills the box
 *
 *     ⟹ c = size / ((n - 1)(1 + g) + f)
 *
 * Consequences, all wanted:
 *
 *   · a dot can never overflow the box, so no clipping margin is needed, and the
 *     field lands exactly on the box at ANY dotSize — including above 1, where the
 *     dots touch or overlap — because `f` is solved for rather than clipped
 *   · the pitch is a function of `size` alone at fixed f and g, so changing `size`
 *     scales the field without changing its proportions
 *   · `dotSize` and `gap` are independent: the dot's share of its cell and the space
 *     between cells are separate dials, as they are in CSS grid
 *   · `gapX ≠ gapY` is legal and meaningful — a vertical stack and a horizontal band
 *     are different objects
 *
 * Each axis is solved on its own, so cols and rows never have to agree. With unequal
 * gaps the two cells differ, and the dot is sized from the SMALLER one so it never
 * overlaps on either axis. Stated rather than hidden: the tighter axis fills the box
 * exactly and the roomier one gets slack. Growing the dot into that slack would need
 * two dot sizes, and a non-square dot is worse than a little air.
 */
export function layout(options: DotMatrixOptions = {}): DotMatrixLayout {
  const o = resolveOptions(options);
  const n = o.cols - 1;
  const m = o.rows - 1;
  const f = Math.max(0.01, o.dotSize);
  const box = o.size * clamp(o.fill, 0.2, 1);
  const gx = Math.max(0, o.gapX);
  const gy = Math.max(0, o.gapY);
  const cellX = n > 0 ? box / (n * (1 + gx) + f) : 0;
  const cellY = m > 0 ? box / (m * (1 + gy) + f) : 0;
  const cell = Math.min(cellX || box, cellY || box) || box;
  return {
    cellX,
    cellY,
    gapX: gx,
    gapY: gy,
    // the pitch is the cell plus the gap — this is what the CSS grid tracks are
    pitchX: n > 0 ? cellX * (1 + gx) : 0,
    pitchY: m > 0 ? cellY * (1 + gy) : 0,
    dotPx: f * cell,
    size: o.size,
  };
}

/**
 * The dot share of its PITCH, which is the number the eye actually judges: 100% is
 * two dots touching. It is NOT 100% of the cell — the pitch is the cell times
 * (1 + gap), so the touching point sits at `1 + gap` on the cell-share dial. A
 * control that only showed the cell share would have a 100% that means nothing
 * stable.
 */
export function dotShareOfPitch(dotSize: number, gap: number): number {
  return dotSize / (1 + Math.max(0, gap));
}

/** the cell-share value at which two dots exactly touch, for a given gap */
export function touchingDotSize(gap: number): number {
  return 1 + Math.max(0, gap);
}
