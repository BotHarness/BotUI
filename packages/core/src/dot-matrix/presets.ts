import type { Preset, PresetName, AgentState } from "../types.js";
import { ORDERS } from "./order.js";
import { ENVELOPES } from "./envelope.js";

/**
 * Presets bind the three independent layers into the named motions a caller picks
 * from. A preset is a triple plus two flags, and it also carries a `task`: the agent
 * state it is meant to express. Naming the presets after MOTION makes the caller do
 * the translation from product language; naming them after the STATE is the
 * vocabulary the rest of an agent UI already speaks. Both are kept — the key is the
 * motion, the label is the job.
 *
 *   css   whether the CSS renderer can express it at all
 *   solid whether the envelope fills its band (a "solid" morph wants a level
 *         plateau rather than a thin comet)
 */
/**
 * Every motion is non-null and only 'off' is null, so a caller reaching for
 * `PRESETS.spiral` is not forced to null-check a table entry that cannot be null —
 * and `presetFor` still has to handle a name this version does not know.
 */
type PresetTable = { [K in PresetName]: K extends "off" ? null : Preset };

export const PRESETS: PresetTable = {
  spiral: { order: "spiral", env: "comet", spread: 0.95, css: true, task: "Thinking" },
  // the two snakes exist because they are the traversals that make sense on a narrow
  // grid: a 2×5 field wants a column snake (down, then back up), and a spiral over it
  // is not a loop at all
  snake: { order: "snake", env: "comet", spread: 0.95, css: true, task: "Advancing" },
  columnSnake: { order: "columnSnake", env: "comet", spread: 0.95, css: true, task: "Serpentine" },
  ripple: { order: "radial", env: "wave", spread: 0.7, css: true, task: "Expanding" },
  ring: { order: "ring", env: "chase", spread: 0.34, css: true, task: "Chasing" },
  diagonal: { order: "diagonal", env: "comet", spread: 0.95, css: true, task: "Sweeping" },
  // a per-dot delay can only offset a dot's phase; a highlight MOVING down the
  // column is not a phase offset, so this preset has no CSS form
  columns: { order: "column", env: "spike", spread: 1, css: false, task: "Column drop" },
  breathe: { order: "center", env: "breathe", spread: 0, css: true, task: "Breathing" },
  // a plateau rather than a thin comet: the level holds, so a fat dot reads as a
  // morphing mass instead of a travelling bead
  morph: { order: "spiral", env: "plateau", spread: 0.5, css: true, task: "Morphing", solid: true },
  off: null,
};

export const PRESET_KEYS = Object.keys(PRESETS) as PresetName[];

/** the agent states this component is meant to cover, and what each maps to */
export const STATE_PRESETS: Record<AgentState, PresetName> = {
  thinking: "spiral",
  working: "morph",
  searching: "diagonal",
  streaming: "columnSnake",
  waiting: "ring",
  error: "ring",
};

export const STATE_KEYS = Object.keys(STATE_PRESETS) as AgentState[];

/** the resolved preset, or null for 'off' / an unknown name */
export function presetFor(name: PresetName | undefined): Preset | null {
  if (!name) return null;
  return (PRESETS as PresetTable)[name] ?? null;
}

/** the traversal and envelope a preset names, resolved. Throws on 'off'. */
export function resolvePreset(name: PresetName) {
  const preset = presetFor(name);
  if (!preset) throw new Error(`BotUI: preset "${name}" has no motion (off)`);
  return {
    preset,
    order: ORDERS[preset.order],
    env: ENVELOPES[preset.env],
  };
}

/** the preset an agent state maps to, for the `<DotMatrix state="thinking">` shorthand */
export function presetForState(state: AgentState | undefined): PresetName {
  if (!state) return "spiral";
  return STATE_PRESETS[state] ?? "spiral";
}
