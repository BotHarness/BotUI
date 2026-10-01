import {
  DEFAULTS,
  GLYPH_DEFAULTS,
  PRESETS,
  type DotGlyphSpec,
  type DotMatrixOptions,
} from "@botharness/botui-core";

/**
 * The snippet a visitor carries away: the install command, and the component with
 * THEIR settings already in it.
 *
 * The point of this page is that you tune something and then keep it. A copy button
 * that yields `npx @botharness/botui add dot-matrix` throws the tuning away — you would
 * have to remember 198% and grow 3% and a pinned 70% stagger and re-derive them from
 * the sliders. So this emits the options as JSX props, and the numbers in it are the
 * numbers on the sliders at the moment you press it.
 *
 * WHY A GENERATED STRING AND NOT A RENDERED EXAMPLE: this is prose for an agent or a
 * person, not a live demo. It is generated from the same `DotMatrixOptions` the engine
 * takes, and the prop names are the real ones — the alternative is a block of JSX that
 * looks right and does not compile, which is the same failure as a card that draws its
 * own approximation of a dot.
 */

/** the options a visitor can actually change on this page */
export interface Tuning {
  options: DotMatrixOptions;
  /** whether the CSS renderer switch is on, which is `renderer` on the component */
  css: boolean;
}

/**
 * Only the options that DIFFER from the engine's defaults.
 *
 * An exhaustive prop list is noise: `fill={1} floor={0.16} peak={1}` on every copy is
 * four lines that say nothing about what you chose, and it goes stale the moment a
 * default changes. Emitting the difference means the snippet is as short as the change
 * you made — a visitor who touched nothing gets `<DotMatrix />`, and one who dragged two
 * sliders gets two props.
 */
function changedOptions(t: Tuning): [string, string][] {
  const o = t.options;
  const out: [string, string][] = [];

  // the order is the order the controls appear on the page, so the snippet reads in the
  // same order the visitor met them
  if ((o.size ?? DEFAULTS.size) !== DEFAULTS.size) out.push(["size", num(o.size)]);
  if ((o.cols ?? DEFAULTS.cols) !== DEFAULTS.cols) out.push(["cols", num(o.cols)]);
  if ((o.rows ?? DEFAULTS.rows) !== DEFAULTS.rows) out.push(["rows", num(o.rows)]);
  if ((o.silhouette ?? DEFAULTS.silhouette) !== DEFAULTS.silhouette) {
    out.push(["silhouette", str(o.silhouette)]);
  }
  if ((o.dot ?? DEFAULTS.dot) !== DEFAULTS.dot) out.push(["dot", str(o.dot)]);
  if ((o.dotSize ?? DEFAULTS.dotSize) !== DEFAULTS.dotSize) out.push(["dotSize", num(o.dotSize)]);
  if ((o.gapX ?? DEFAULTS.gapX) !== DEFAULTS.gapX) out.push(["gapX", num(o.gapX)]);
  if ((o.gapY ?? DEFAULTS.gapY) !== DEFAULTS.gapY) out.push(["gapY", num(o.gapY)]);
  if ((o.preset ?? DEFAULTS.preset) !== DEFAULTS.preset) out.push(["preset", str(o.preset)]);

  // direction is a LIST of axis tokens, and an empty one is the motion's own direction —
  // so the default stays silent and a visitor who set two axes gets both, in one prop
  const dir = o.direction ?? [];
  // `color` is added here rather than in the list above, because the value can be ANY
  // string CSS accepts — `var(--brand)`, `color-mix(...)`, a named colour — so it must not
  // go through a formatter that would rewrite it. Silent when unset, because
  // `currentColor` is what the engine already resolves on its own.
  if (o.color != null && o.color !== DEFAULTS.color) out.push(["color", str(o.color)]);

  // no braces around the value: the renderer already emits `name={value}`
  if (dir.length) out.push(["direction", `[${dir.map((d) => `"${d}"`).join(", ")}]`]);
  if ((o.speed ?? DEFAULTS.speed) !== DEFAULTS.speed) out.push(["speed", num(o.speed)]);
  if (o.stagger != null) out.push(["stagger", num(o.stagger)]);
  if ((o.softness ?? DEFAULTS.softness) !== DEFAULTS.softness)
    out.push(["softness", num(o.softness)]);
  if ((o.grow ?? DEFAULTS.grow) !== DEFAULTS.grow) out.push(["grow", num(o.grow)]);
  if ((o.floor ?? DEFAULTS.floor) !== DEFAULTS.floor) out.push(["floor", num(o.floor)]);

  // the dot's own geometry, as one nested object — these are the numbers a `sides`
  // slider moved, and flattening them into top-level props would be wrong: the component
  // takes them under `spec`
  const spec = diffSpec(o.spec);
  if (spec) out.push(["spec", spec]);

  return out;
}

function diffSpec(spec: Partial<DotGlyphSpec> | undefined): string | null {
  if (!spec) return null;
  const parts: string[] = [];
  for (const key of ["sides", "radius", "innerRadius", "star", "spin", "aspect"] as const) {
    const v = spec[key];
    if (v != null && v !== GLYPH_DEFAULTS[key]) parts.push(`${key}: ${num(v)}`);
  }
  return parts.length ? `{ ${parts.join(", ")} }` : null;
}

/** numbers keep their decimals rather than rounding a value the visitor can see */
function num(v: number | undefined): string {
  return v == null ? "undefined" : String(Math.round(v * 1000) / 1000);
}

/** a string option is a bare JSX attribute: `dot="star5"`, not `dot={"star5"}` */
function str(v: string | undefined): string {
  return `"${v ?? ""}"`;
}

/** a bare JSX attribute, for a value that is a keyword rather than a string */
function attr(name: string, value: string): string {
  return `${name}="${value}"`;
}

/**
 * The whole thing: what to run, what to import, and the component with the settings on.
 *
 * Ordered so the first thing a reader can act on is the install command — it is the only
 * line that has to be true before anything else matters.
 */
export function snippet(
  t: Tuning,
  locale: { install: string; intro: string; style: string },
): string {
  const props = changedOptions(t);
  const preset = t.options.preset ?? DEFAULTS.preset;
  // `renderer` is the one prop that is a BARE attribute when it appears — `css` is a
  // keyword rather than a string — and it only appears when it is NOT the default, by
  // the same rule as every other prop: `svg` is the default, so stating it would be noise.
  const lines = props.map(([k, v]) => `  ${k}={${v}}`);
  if (t.css) lines.push(`  ${attr("renderer", "css")}`);

  const body = lines.join("\n");

  return [
    locale.intro,
    "",
    "1. Install it:",
    "",
    "   " + locale.install,
    "",
    "2. Render it with these settings:",
    "",
    body ? "<DotMatrix\n" + body + "\n/>" : "<DotMatrix />",
    "",
    "3. Once, in your app entry:",
    "",
    "   " + locale.style,
    "",
    `   // preset "${preset}" renders as ${describe(preset)}`,
  ].join("\n");
}

/**
 * What the motion means, in one line.
 *
 * Copied out of the same table the preset cards label themselves from, so the sentence
 * cannot drift from the card — a hand-written description of `ring` next to a card that
 * shows `ring` is two sources for one fact.
 */
function describe(preset: string): string {
  // `PRESETS.off` is null — no motion has no order or envelope — so this must not
  // assume the entry exists or it prints "undefined traversal"
  const p = PRESETS[preset as keyof typeof PRESETS] ?? null;
  if (!p) return "no motion (frozen)";
  return `${p.order} traversal, ${p.env} envelope`;
}
