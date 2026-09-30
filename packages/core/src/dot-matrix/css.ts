import type { PresetName } from "../types.js";
import { PRESET_KEYS } from "./presets.js";
import { keyframesFor } from "./field.js";

/**
 * The component's stylesheet, as a string.
 *
 * It ships as text rather than a .css file for one reason: the @keyframes depend on
 * `softness`, so they are REGENERATED whenever that option changes. A static file
 * could only ever hold the softness-0 curve, and the CSS renderer would then
 * disagree with the SVG one for every value except the default. Owning the text lets
 * both renderers be driven by the same function.
 */
export function stylesheet(softness = 0): string {
  const frames = PRESET_KEYS.map((name) => keyframesFor(name as PresetName, softness))
    .filter(Boolean)
    .join("\n");
  return `${BASE_CSS}\n${frames}\n`;
}

const BASE_CSS = `/* BotUI · dot matrix — the CSS renderer.
 *
 * The glyph is a mask of the SAME path data the SVG renderer draws, so the two
 * cannot disagree about the silhouette — and a five-point star is expressible at
 * all only because a mask is real geometry rather than a border-radius.
 *
 * Layout numbers (track sizes, the dot's share of its cell) are written onto the
 * host as custom properties by the runtime, in px, from the explicit \`size\`.
 * Nothing here measures the DOM.
 */
.botui-dot-matrix {
  display: grid;
  place-content: center;
  /* explicit tracks, never 1fr: 1fr divides the box between tracks and ignores
     the field's own pitch, so the layout drifts away from the SVG one */
  grid-template-columns: repeat(var(--botui-cols, 7), 1fr);
  color: inherit;
  contain: layout paint;
}

.botui-dot-matrix > i {
  display: block;
  background: currentColor;
  transform-origin: center;
  -webkit-mask: var(--botui-mask) center / calc(var(--botui-fill, 1) * 100%) no-repeat;
  mask: var(--botui-mask) center / calc(var(--botui-fill, 1) * 100%) no-repeat;
  /* \`scale\` is animated and \`transform\` stays free for the glyph's own rotation,
     so the two compose instead of overwriting each other */
  scale: var(--botui-s-min, 0.5);
  animation: var(--botui-anim, botui-dm-spiral) var(--botui-cycle, 1500ms) linear infinite;
  /* a NEGATIVE delay seeds each cell partway into one shared cycle, so the field
     is already in flight on the first painted frame and every cell runs the
     identical keyframes — the per-cell value is one number */
  animation-delay: calc(var(--botui-o, 0) * var(--botui-seed, -0.95) * var(--botui-cycle, 1500ms));
}


/* Reduced motion: no cycle at all. Each dot holds a static level derived from its
 * own traversal position, so the field still reads as a lit matrix — a still
 * gradient, not a frozen frame of the animation. */
@media (prefers-reduced-motion: reduce) {
  .botui-dot-matrix > i {
    animation: none;
    opacity: calc(
      var(--botui-floor, 0.16) +
        (var(--botui-peak, 1) - var(--botui-floor, 0.16)) * calc(1 - var(--botui-o, 0))
    );
    scale: 1;
  }
}
`;

const STYLE_ID = "botui-dot-matrix-keyframes";

/** the shared <style> element, created on first use */
function styleElement(doc: Document): HTMLStyleElement {
  const existing = doc.getElementById(STYLE_ID);
  if (existing) return existing as HTMLStyleElement;
  const style = doc.createElement("style");
  style.id = STYLE_ID;
  doc.head.appendChild(style);
  return style;
}

/**
 * Publish the keyframes for a given softness. Idempotent, and it only touches the
 * DOM when the text actually changed — rewriting it on every frame would restart
 * every animation, which is visible as a stutter.
 */
export function ensureStylesheet(doc: Document, softness = 0): HTMLStyleElement {
  const style = styleElement(doc);
  const css = stylesheet(softness);
  if (style.textContent !== css) style.textContent = css;
  return style;
}
