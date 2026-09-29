import { m } from "./paraglide/messages.js";
import { DOT_SHAPES, PRESETS, type DotShape, type PresetName } from "@botharness/botui-core";

/**
 * Lookups from the engine's keys to translated text.
 *
 * The engine names things — `square`, `spiral`, `thinking` — and those names are
 * identifiers, not copy. They are stable and they are what the component options
 * take, so the translation belongs on top of them rather than inside them: a
 * component saved as `dot: 'star5'` has to keep working, and a library that shipped
 * one language in its source would force every consumer to patch it.
 *
 * The maps are written out rather than indexed dynamically. Paraglide compiles each
 * message into its own function so the bundler can drop the unused ones, and a
 * `m[key]()` lookup defeats that — plus a typo in a key would be `undefined` at
 * runtime instead of a type error here. A missing entry falls back to the engine's
 * own English name, so a new glyph added to the core shows up untranslated rather
 * than as a blank control.
 */

type GlyphKey = Exclude<DotShape, "custom">;

const GLYPH_LABEL: Record<GlyphKey, () => string> = {
  square: m.glyph_square,
  rounded: m.glyph_rounded,
  circle: m.glyph_circle,
  ellipse: m.glyph_ellipse,
  triangle: m.glyph_triangle,
  diamond: m.glyph_diamond,
  pentagon: m.glyph_pentagon,
  hexagon: m.glyph_hexagon,
  star4: m.glyph_star4,
  star5: m.glyph_star5,
  star6: m.glyph_star6,
  burst: m.glyph_burst,
  drop: m.glyph_drop,
  bar: m.glyph_bar,
};

export function glyphLabel(key: DotShape): string {
  if (key === "custom") return key;
  return GLYPH_LABEL[key]?.() ?? DOT_SHAPES[key]?.label ?? key;
}

/**
 * The agent state a motion is meant to express.
 *
 * The engine's `preset.task` was Chinese, which is a bug in a bilingual library
 * rather than a default: it means an English consumer sees 思考中 with no way to
 * change it. The string stays in the engine as a last-resort fallback, but the
 * translated copy is keyed off the preset name here.
 */
const TASK_LABEL: Record<Exclude<PresetName, "off">, () => string> = {
  spiral: m.task_thinking,
  snake: m.task_advancing,
  columnSnake: m.task_serpentine,
  ripple: m.task_expanding,
  ring: m.task_chasing,
  diagonal: m.task_sweeping,
  columns: m.task_column_drop,
  breathe: m.task_breathing,
  morph: m.task_morphing,
};

export function taskLabel(preset: PresetName): string {
  if (preset === "off") return "off";
  return TASK_LABEL[preset]?.() ?? PRESETS[preset]?.task ?? preset;
}

const POLYGON_NAME: Record<number, () => string> = {
  3: m.poly_triangle,
  4: m.poly_square,
  5: m.poly_pentagon,
  6: m.poly_hexagon,
  7: m.poly_heptagon,
  8: m.poly_octagon,
  9: m.poly_nonagon,
  10: m.poly_decagon,
};

export function polygonName(sides: number): string {
  return POLYGON_NAME[sides]?.() ?? m.poly_gon({ sides: String(sides) });
}

/**
 * The silhouette's own name.
 *
 * Same reasoning as the glyphs: `circle` is the value the option takes, and a Chinese
 * page reading "silhouette circle" is a page that has leaked an implementation detail
 * into the copy.
 */
const SILHOUETTE_LABEL: Record<string, () => string> = {
  square: m.sil_square,
  circle: m.sil_circle,
  diamond: m.sil_diamond,
  hex: m.sil_hex,
  ring: m.sil_ring,
  cross: m.sil_cross,
};

export function silhouetteLabel(key: string): string {
  return SILHOUETTE_LABEL[key]?.() ?? key;
}

export { m };
