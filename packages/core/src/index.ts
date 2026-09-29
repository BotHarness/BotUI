/**
 * BotUI · dot-matrix
 *
 * A loading indicator as a layered component. Each layer is replaceable on its own,
 * which is the whole point: "which silhouette", "which motion", "which dot" are
 * independent questions, and every one of them is a table you can add to without
 * touching the layers above.
 *
 *   1  LATTICE    cellsFor(cols, rows, silhouette)   → which cells exist, where
 *   2  ORDER      ORDERS[name](col,row,cols,rows)    → 0…1 traversal position
 *   3  ENVELOPE   softLevel(p, env, softness)        → brightness over the phase
 *   4  GLYPH      glyphPath(spec)                    → how one dot is drawn
 *   5  RENDERER   SVG (per frame) | CSS (@keyframes) → where the pixels go
 *
 * The public API is the tables plus `createDotMatrix`; everything else is exported
 * because a caller building their own renderer needs the same pieces the built-in
 * ones use, and re-deriving them is how two renderers start disagreeing.
 */

export type {
  AgentState,
  DotGlyphSpec,
  DotMatrixHandle,
  DotMatrixLayout,
  DotMatrixOptions,
  DotRecord,
  DotShape,
  Envelope,
  EnvelopeStop,
  GlyphPath,
  LatticeCell,
  Order,
  OrderFn,
  Preset,
  PresetName,
  ResolvedDotMatrixOptions,
  Silhouette,
  SilhouetteFn,
} from "./types.js";

export {
  DEFAULTS,
  dotShareOfPitch,
  layout,
  resolveOptions,
  touchingDotSize,
} from "./dot-matrix/layout.js";
export { SILHOUETTES, SILHOUETTE_KEYS, cellsFor } from "./dot-matrix/lattice.js";
export { ORDER_KEYS, ORDERS, orderFor, snakePath, spiralPath } from "./dot-matrix/order.js";
export {
  ENVELOPES,
  ENVELOPE_KEYS,
  envelope,
  level,
  phaseFor,
  softLevel,
  stretched,
} from "./dot-matrix/envelope.js";
export {
  DOT_SHAPES,
  DOT_SHAPE_KEYS,
  GLYPH_DEFAULTS,
  bbox,
  fillet,
  glyphPath,
  inradius,
  specFor,
  vertices,
} from "./dot-matrix/glyph.js";
export {
  PRESETS,
  PRESET_KEYS,
  STATE_KEYS,
  STATE_PRESETS,
  cssRenderGap,
  cssRenderable,
  presetFor,
  presetForState,
  resolvePreset,
} from "./dot-matrix/presets.js";
export {
  applyCssVars,
  buildCss,
  buildSvg,
  field,
  keyframesFor,
  maskFor,
  renderSvg,
  resolveField,
} from "./dot-matrix/field.js";
export type { ResolvedField } from "./dot-matrix/field.js";
export { ensureStylesheet, stylesheet } from "./dot-matrix/css.js";
export { createDotMatrix } from "./dot-matrix/matrix.js";
export { clamp, clamp01, frac, round, TAU } from "./internal/math.js";
