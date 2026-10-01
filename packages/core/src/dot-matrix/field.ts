import type {
  DotMatrixOptions,
  DotRecord,
  Envelope,
  GlyphPath,
  OrderFn,
  Preset,
  PresetName,
  ResolvedDotMatrixOptions,
} from "../types.js";
import { clamp01, round } from "../internal/math.js";
import { cellsFor } from "./lattice.js";
import { orderFor } from "./order.js";
import { ENVELOPES, phaseFor, softLevel, stretched } from "./envelope.js";
import { glyphPath, specFor } from "./glyph.js";
import { layout, resolveOptions } from "./layout.js";
import { presetFor } from "./presets.js";

const SVG_NS = "http://www.w3.org/2000/svg";

/** everything a renderer needs, resolved once per paint */
export interface ResolvedField {
  options: ResolvedDotMatrixOptions;
  preset: Preset;
  order: OrderFn;
  env: Envelope;
  /** the preset's stagger, unless the caller overrode it */
  spread: number;
  glyph: GlyphPath;
  layout: ReturnType<typeof layout>;
}

export function resolveField(options: DotMatrixOptions = {}): ResolvedField | null {
  const o = resolveOptions(options);
  const preset = presetFor(o.preset);
  if (!preset) return null;
  return {
    options: o,
    preset,
    order: orderFor(preset.order),
    env: ENVELOPES[preset.env],
    spread: o.stagger ?? preset.spread,
    glyph: glyphPath(specFor(o.dot, o.spec)),
    layout: layout(o),
  };
}

/**
 * The field, IN PIXELS for a field of the given `size`. A pure function of
 * (options, t) — the caller owns the phase, so the field is seekable, pausable and
 * replayable, with no internal clock.
 *
 * Each record carries the resolved glyph path, so a renderer never re-derives the
 * silhouette and the two paths cannot drift apart.
 */
export function field(options: DotMatrixOptions, t: number): DotRecord[] {
  const resolved = resolveField(options);
  if (!resolved) return [];
  const { options: o, order, env, spread, glyph, layout: L } = resolved;
  // every glyph is scaled to the SAME bounding box, so dotSize means "how much of
  // the cell the dot takes" for a square, a circle and a star alike
  const r0 = L.dotPx / 2 / glyph.box;
  const out: DotRecord[] = [];
  for (const c of cellsFor(o.cols, o.rows, o.silhouette)) {
    // the order is taken on the full lattice, so trimming the silhouette never
    // renumbers the motion and a shape change never restarts it
    const ord = order(c.col, c.row, o.cols, o.rows, o.direction);
    const v = clamp01(softLevel(phaseFor(t, ord, spread, o.speed), env, o.softness));
    out.push({
      x: round((c.col - (o.cols - 1) / 2) * L.pitchX),
      y: round((c.row - (o.rows - 1) / 2) * L.pitchY),
      r: round(r0 * (1 - o.grow + o.grow * v)),
      opacity: round(o.floor + (o.peak - o.floor) * v, 4),
      order: round(ord, 4),
      v: round(v, 4),
      col: c.col,
      row: c.row,
      d: glyph.d,
    });
  }
  return out;
}

/**
 * The field as SVG MARKUP, for a server render or a static snapshot.
 *
 * Same field, same coordinates, same glyph paths as `buildSvg` — a second renderer
 * would be a second chance to disagree with the first, so this only serialises
 * what `field()` already produced.
 */
export function renderSvg(options: DotMatrixOptions, t: number): string {
  const o = resolveOptions(options);
  const body = field(o, t)
    .map(
      (d) =>
        `<path d="${d.d}" transform="translate(${d.x.toFixed(2)} ${d.y.toFixed(2)}) scale(${d.r.toFixed(3)})" ` +
        `fill-opacity="${d.opacity.toFixed(3)}"/>`,
    )
    .join("");
  return (
    `<svg xmlns="${SVG_NS}" viewBox="${-o.size / 2} ${-o.size / 2} ${o.size} ${o.size}" ` +
    `width="${o.size}" height="${o.size}" fill="${o.color}" shape-rendering="geometricPrecision" ` +
    `aria-hidden="true">${body}</svg>`
  );
}

/**
 * A data-URI mask of a unit-scale path. The viewBox is padded so a glyph that
 * touches its own bounding box is not clipped by the mask edge. This is the reason
 * the CSS renderer can draw a five-point star at all: a border-radius rule can
 * express a circle and a rounded box and nothing else, whereas a mask is the same
 * geometry the SVG path draws.
 */
export function maskFor(d: string): string {
  const svg =
    `<svg xmlns="${SVG_NS}" viewBox="-1.15 -1.15 2.3 2.3">` +
    `<path d="${d}" fill="#fff" transform="scale(1)"/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

/** build the SVG element for a field — what the SVG renderer mounts */
export function buildSvg(options: DotMatrixOptions, t: number): SVGSVGElement {
  const o = resolveOptions(options);
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", `${-o.size / 2} ${-o.size / 2} ${o.size} ${o.size}`);
  svg.setAttribute("width", String(o.size));
  svg.setAttribute("height", String(o.size));
  svg.setAttribute("fill", o.color);
  svg.setAttribute("shape-rendering", "geometricPrecision");
  svg.setAttribute("aria-hidden", "true");
  for (const d of field(o, t)) {
    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("d", d.d);
    path.setAttribute(
      "transform",
      `translate(${d.x.toFixed(2)} ${d.y.toFixed(2)}) scale(${d.r.toFixed(3)})`,
    );
    path.setAttribute("fill-opacity", d.opacity.toFixed(3));
    svg.appendChild(path);
  }
  return svg;
}

/**
 * Push the resolved layout and motion onto a CSS host as custom properties.
 *
 * Returns whether the host's EXISTING cells are the right ones. False means the lattice
 * itself changed — different `cols`/`rows`, or a different `silhouette`, so the cells have
 * to be built again — and the caller must rebuild rather than patch.
 *
 * The per-cell traversal `--botui-o` is re-ranked HERE, in place, and that is the whole
 * reason this function touches the cells rather than only the host. A cell's phase offset
 * is baked into its inline style when the host is built, so an option that changes the
 * RANKING — `direction`, or anything that renumbers the traversal — reaches the CSS
 * renderer only by rewriting that one property. `direction` was added and appeared to do
 * nothing on the site's default renderer: the playground's state updated, the copied
 * snippet said `direction={["counterClockwise"]}`, and the field ran the old way, because
 * the host-level variables are a small fixed set and the traversal was not among them.
 *
 * Rewriting the property does NOT restart the animation — `animation-delay` is recomputed
 * and the running effect re-phases — so a direction change shifts the wave rather than
 * stuttering it. Replacing the DOM would restart every animation, which is why this is a
 * patch and not a rebuild.
 */
export function applyCssVars(host: HTMLElement, resolved: ResolvedField): boolean {
  const { options: o, env, spread, glyph, layout: L } = resolved;
  // the SAME layout numbers the SVG renderer used — in px, from the explicit
  // `size`, never from a measurement
  host.style.width = `${o.size}px`;
  host.style.height = `${o.size}px`;
  const pitchX = L.pitchX || L.dotPx;
  const pitchY = L.pitchY || L.dotPx;
  // Explicit track sizes, not 1fr: `1fr` divides the box between tracks and ignores
  // the field's own pitch, so the CSS layout drifts away from the SVG one. The
  // tracks are also named per dot (grid-area below), so the holes a silhouette
  // leaves stay holes.
  host.style.gridTemplateColumns =
    o.cols > 1 ? `repeat(${o.cols}, ${pitchX.toFixed(2)}px)` : `${L.dotPx.toFixed(2)}px`;
  host.style.gridTemplateRows =
    o.rows > 1 ? `repeat(${o.rows}, ${pitchY.toFixed(2)}px)` : `${L.dotPx.toFixed(2)}px`;
  // the dot's share of its cell — this is what makes the dotSize dial reach the CSS
  // renderer at all. `contain` would pin every dot to 100% of its cell.
  host.style.setProperty("--botui-fill", (L.dotPx / pitchX).toFixed(4));
  host.style.setProperty("--botui-mask", maskFor(glyph.d));
  // Seed each cell partway into ONE shared cycle with a NEGATIVE delay.
  //
  // A positive delay would leave the first cells sitting at the floor for a whole
  // cycle before the comet sets off; negative seeds them mid-flight, so the field is
  // already moving on the first painted frame. It also means every cell runs the
  // identical keyframes — the only per-cell value is one number, which is what keeps
  // the CSS renderer at zero JS per frame.
  host.style.setProperty("--botui-anim", `botui-dm-${o.preset}`);
  host.style.setProperty("--botui-cycle", `${(env.cycleMs ?? 1500) / o.speed}ms`);
  host.style.setProperty("--botui-seed", String(-spread));
  host.style.setProperty("--botui-s-min", (1 - o.grow).toFixed(3));
  host.style.setProperty("--botui-s", (1 + o.grow * 0.9).toFixed(3));
  host.style.color = o.color;
  host.dataset.timing = "linear";
  return rankCells(host, resolved);
}

/**
 * Re-rank the host's cells against the current traversal, in place.
 *
 * The cells are addressed by their own `grid-area`, so this also VERIFIES that the host
 * still holds the cells these options call for. Rebuilding is reserved for the case where
 * they are not: appending to a host whose cells belong to another lattice leaves a field
 * that is the right size and the wrong dots, which is worse than either renderer.
 */
function rankCells(host: HTMLElement, resolved: ResolvedField): boolean {
  const { options: o, order } = resolved;
  const want = cellsFor(o.cols, o.rows, o.silhouette);
  const cells = host.children;
  if (cells.length !== want.length) return false;
  for (let i = 0; i < want.length; i++) {
    const c = want[i]!;
    const el = cells[i] as HTMLElement;
    // The cell's own address, not a read-back of `grid-area`. The shorthand round-trips
    // through the CSS parser, and the `grid-row-start` longhands it would decompose into
    // are not implemented everywhere jsdom is used — so deriving the address back out of
    // the style made this sync check report "rebuild" on every update in a test DOM.
    if (el.dataset.cell !== `${c.row},${c.col}`) return false;
    el.style.setProperty("--botui-o", order(c.col, c.row, o.cols, o.rows, o.direction).toFixed(3));
  }
  return true;
}

/**
 * build the CSS host: a grid of `<i>` whose only motion is @keyframes offset per dot.
 *
 * Returns null for a preset the CSS renderer cannot express — a per-dot delay can
 * only OFFSET a dot's phase, never MOVE a highlight down a column. Rendering one
 * anyway would not fail loudly: every dot in a column shares a traversal position,
 * so the travelling gaussian would collapse into a static bar per column, and the
 * caller would get a plausible-looking field that is quietly the wrong motion.
 */
export function buildCss(options: DotMatrixOptions): HTMLElement | null {
  const resolved = resolveField(options);
  if (!resolved) return null;
  if (!resolved.preset.css) return null;
  const { options: o, order } = resolved;
  const host = document.createElement("div");
  host.className = "botui-dot-matrix";
  host.dataset.preset = o.preset;
  host.setAttribute("aria-hidden", "true");
  applyCssVars(host, resolved);
  for (const c of cellsFor(o.cols, o.rows, o.silhouette)) {
    const dot = document.createElement("i");
    // Each dot must be PLACED, not just appended. Grid auto-placement packs items
    // into the free cells, so omitting the cells a silhouette masks slides every
    // later dot up and to the left — a circle turns into a ragged block in the
    // corner instead of a ring. Naming the cell keeps the holes as holes, which is
    // what makes the CSS layout match the SVG one.
    dot.style.gridArea = `${c.row + 1} / ${c.col + 1}`;
    // the cell's own address, so a later update can verify it still holds this cell and
    // re-rank it in place rather than rebuilding the host
    dot.dataset.cell = `${c.row},${c.col}`;
    // the raw 0…1 traversal position, kept for the reduced-motion static ramp
    dot.style.setProperty("--botui-o", order(c.col, c.row, o.cols, o.rows, o.direction).toFixed(3));
    host.appendChild(dot);
  }
  return host;
}

/**
 * The @keyframes a preset needs, as a rule string.
 *
 * Every stop animates BOTH `opacity` and `scale`. That pairing is the whole breath: a
 * dot whose opacity alone changes reads as a lampshade, while the size following the
 * brightness reads as alive. `scale` is animated rather than folded into `transform`
 * so a glyph can keep its own transform (a rotated diamond) without the animation
 * overwriting it every frame.
 *
 * The stop positions come from the envelope's own (possibly stretched) stops, so the
 * CSS curve is the SAME curve the SVG renderer evaluates — sampling the original
 * positions through a stretched envelope would put every keyframe on the wrong side
 * of the wave.
 */
export function keyframesFor(presetName: PresetName, softness = 0): string | null {
  const preset = presetFor(presetName);
  if (!preset) return null;
  // No keyframes for a preset the CSS renderer refuses, by the same rule `buildCss`
  // applies. Publishing them was a LIE rather than dead weight: the spike envelope is a
  // gaussian centred on the seam, so sampling it at the two keyframe positions the stop
  // table names — 0 and 1 — yields full brightness at BOTH, and the emitted rule animates
  // nothing. `spike` cannot be sampled without knowing the cycle.
  if (!preset.css) return null;
  const env = ENVELOPES[preset.env];
  const at = (p: number) => {
    const s = clamp01(softLevel(p, env, softness));
    return (
      `${(p * 100).toFixed(2)}%{opacity:calc(var(--botui-floor, 0.16) + (var(--botui-peak, 1) - var(--botui-floor, 0.16)) * ${s.toFixed(3)});` +
      `scale:calc(var(--botui-s-min, 0.5) + (var(--botui-s, 1.45) - var(--botui-s-min, 0.5)) * ${s.toFixed(3)})}`
    );
  };
  const positions = (stretched(env, softness) ?? env).stops.map(([p]) => p);
  return `@keyframes botui-dm-${presetName}{${positions.map((p) => at(p)).join("")}${at(1)}}`;
}
