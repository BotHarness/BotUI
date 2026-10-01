/**
 * Colour notation, for a picker that has to speak more than one.
 *
 * The engine takes any string CSS accepts — it is handed to `color` on the CSS host and
 * to `fill` on the SVG root, with no parsing of its own. That is deliberate: a component
 * that validated colour would refuse `var(--brand)` and `color-mix()`, both of which are
 * things a real design system hands it.
 *
 * So the parsing lives HERE, on the page, where it exists only to drive the control. Three
 * notations, and the conversions between them:
 *
 *   hex   #rgb / #rrggbb / #rrggbbaa     what a colour input speaks
 *   rgb   rgb(r g b) / rgb(r g b / a)     what people read off a design tool
 *   hsl   hsl(h s% l%)                    what people actually pick in
 *
 * WHY NOT A LIBRARY: this is ~90 lines of well-specified arithmetic, the site has no runtime
 * dependencies by policy, and a picker whose round-trip loses a colour is worse than no
 * picker. The round-trip is asserted rather than assumed.
 */

/** what a control can show and a user can edit */
export type Notation = "hex" | "rgb" | "hsl";

export interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

export const isHex = (v: string): boolean =>
  /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(v.trim());

/** `#abc` and `#abcd` are shorthand; expanding them is lossless */
export function parseHex(v: string): Rgba | null {
  const t = v.trim().replace(/^#/, "");
  if (![3, 4, 6, 8].includes(t.length)) return null;
  if (!/^[0-9a-f]+$/i.test(t)) return null;
  const wide = t.length <= 4 ? [...t].map((c) => c + c).join("") : t;
  return {
    r: parseInt(wide.slice(0, 2), 16),
    g: parseInt(wide.slice(2, 4), 16),
    b: parseInt(wide.slice(4, 6), 16),
    a: wide.length === 8 ? round2(parseInt(wide.slice(6, 8), 16) / 255) : 1,
  };
}

/** `rgb(12 34 56)`, `rgb(12, 34, 56)`, with an optional alpha — every spelling in use */
export function parseRgb(v: string): Rgba | null {
  const m = /^rgba?\(\s*([^)]+)\s*\)$/i.exec(v.trim());
  if (!m) return null;
  // comma or space separated, and `12 34 56 / 0.5` for the alpha
  const [body, alpha] = m[1]!.split("/");
  const parts = body!
    .trim()
    .split(/[\s,]+/)
    .filter(Boolean);
  if (parts.length < 3) return null;
  const num = (s: string) => {
    const n = s!.endsWith("%") ? (parseFloat(s!) / 100) * 255 : parseFloat(s!);
    return Number.isFinite(n) ? clamp255(n) : NaN;
  };
  const r = num(parts[0]!);
  const g = num(parts[1]!);
  const b = num(parts[2]!);
  if (![r, g, b].every(Number.isFinite)) return null;
  return {
    r,
    g,
    b,
    a: alpha === undefined ? 1 : clamp01(parseFloat(alpha.trim())),
  };
}

export function parseHsl(v: string): Rgba | null {
  const m = /^hsla?\(\s*([^)]+)\s*\)$/i.exec(v.trim());
  if (!m) return null;
  const [body, alpha] = m[1]!.split("/");
  const parts = body!
    .trim()
    .split(/[\s,]+/)
    .filter(Boolean);
  if (parts.length < 3) return null;
  const h = ((parseFloat(parts[0]!) % 360) + 360) % 360;
  const s = clamp01(parseFloat(parts[1]!) / 100);
  const l = clamp01(parseFloat(parts[2]!) / 100);
  if (![h, s, l].every(Number.isFinite)) return null;
  const { r, g, b } = hslToRgb(h, s, l);
  return { r, g, b, a: alpha === undefined ? 1 : clamp01(parseFloat(alpha.trim())) };
}

/** parse whichever notation it is, in the order a browser would */
export function parseColor(v: string): Rgba | null {
  const t = v.trim();
  if (isHex(t)) return parseHex(t);
  if (/^rgba?\(/i.test(t)) return parseRgb(t);
  if (/^hsla?\(/i.test(t)) return parseHsl(t);
  return null;
}

// ── formatting ───────────────────────────────────────────────────────────────────────────

/** six digits, or eight when the colour is not opaque — dropping the alpha would lie */
export function toHex({ r, g, b, a }: Rgba): string {
  const h = (n: number) => Math.round(clamp255(n)).toString(16).padStart(2, "0");
  const base = `#${h(r)}${h(g)}${h(b)}`;
  return a >= 1
    ? base
    : `${base}${Math.round(clamp01(a) * 255)
        .toString(16)
        .padStart(2, "0")}`;
}

/** the modern space-separated form, which is what current CSS tooling emits */
export function toRgb({ r, g, b, a }: Rgba): string {
  const n = (x: number) => Math.round(clamp255(x));
  const base = `rgb(${n(r)} ${n(g)} ${n(b)}`;
  return a >= 1 ? `${base})` : `${base} / ${round2(clamp01(a))})`;
}

export function toHsl({ r, g, b, a }: Rgba): string {
  const { h, s, l } = rgbToHsl(r, g, b);
  const base = `hsl(${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%)`;
  return a >= 1 ? base : `${base.replace(")", ` / ${round2(clamp01(a))})`)}`;
}

/** render a colour in the requested notation, or null when it cannot be parsed */
export function format(v: string, notation: Notation): string | null {
  const c = parseColor(v);
  if (!c) return null;
  return notation === "hex" ? toHex(c) : notation === "rgb" ? toRgb(c) : toHsl(c);
}

// ── conversions ─────────────────────────────────────────────────────────────────────────

/** sRGB → HSL. The achromatic case has no hue, and reporting 0 rather than NaN matters:
 *  a grey picker that shows hue 0 would claim the grey is red. */
export function rgbToHsl(r: number, g: number, b: number) {
  const rn = clamp255(r) / 255;
  const gn = clamp255(g) / 255;
  const bn = clamp255(b) / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) * 60;
  else if (max === gn) h = ((bn - rn) / d + 2) * 60;
  else h = ((rn - gn) / d + 4) * 60;
  return { h, s, l };
}

export function hslToRgb(h: number, s: number, l: number) {
  const hh = (((h % 360) + 360) % 360) / 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((hh * 6) % 2) - 1));
  const m = l - c / 2;
  const seg = Math.floor(hh * 6) % 6;
  const [r, g, b] = [
    [c, x, 0],
    [x, c, 0],
    [0, c, x],
    [0, x, c],
    [x, 0, c],
    [c, 0, x],
  ][seg]!;
  return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 };
}

/**
 * What the browser actually resolved a colour to.
 *
 * `currentColor` — the engine's default — has no pixel value of its own, so a picker
 * cannot show it as a hex. Resolving it against a real element is the only honest answer,
 * and it means the swatch opens on the colour the page is already using rather than on a
 * default the visitor never asked for.
 */
export function resolveComputed(value: string, against?: Element | null): string | null {
  if (typeof document === "undefined") return null;
  if (!value.trim() || value === "none" || value === "transparent") return null;
  if (value === "currentColor") {
    // no probe of its own: `currentColor` IS the element's colour, so read it there.
    // Resolving it against the document body shows a colour from somewhere else on the
    // page — or black, where nothing sets one, which is how a swatch ends up lying.
    if (!against) return null;
    const own = getComputedStyle(against).color;
    const parsed = parseColor(own);
    return parsed ? toHex(parsed) : null;
  }
  const probe = document.createElement("span");
  probe.style.color = value;
  // off-screen rather than `display: none`, which would make the computed value useless
  probe.style.position = "absolute";
  probe.style.opacity = "0";
  probe.style.pointerEvents = "none";
  document.body.appendChild(probe);
  const computed = getComputedStyle(probe).color;
  probe.remove();
  const parsed = parseColor(computed);
  return parsed ? toHex(parsed) : null;
}

const clamp255 = (n: number) => (Number.isFinite(n) ? Math.min(255, Math.max(0, n)) : 0);
const clamp01 = (n: number) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);
const round2 = (n: number) => Math.round(n * 100) / 100;
