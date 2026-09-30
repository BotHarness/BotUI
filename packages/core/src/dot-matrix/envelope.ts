import type { Envelope, EnvelopeName, EnvelopeStop } from "../types.js";
import { clamp01, frac } from "../internal/math.js";

/**
 * A comet, as a stop table — the thing a smooth falloff actually is. `p` is the
 * position in the cycle; stops are [position, brightness].
 *
 * Two rules, both learned the hard way:
 *
 * · Never quantise brightness into shelves. Shelves are visible as steps and read
 *   as cheap; a piecewise-linear decay with corners still reads as a gradient. A
 *   narrow travelling band resting on a dark floor for most of the cycle is what
 *   reads as "beads chasing" rather than "one soft glow".
 *
 * · A hand-built stop table MUST start and end at `rest`. The band begins exactly
 *   where the rest of the cycle ends, so a stop that sits away from `rest` steps
 *   the cell across the p = 0 → 1 seam once per cycle — a visible twitch at the top
 *   of the loop, and a step `softness` then fights instead of smoothing.
 */
export function envelope(p: number, stops: readonly EnvelopeStop[], rest: number): number {
  if (p >= 1) return rest;
  for (let i = 1; i < stops.length; i++) {
    const [p1, v1] = stops[i]!;
    if (p <= p1) {
      const [p0, v0] = stops[i - 1]!;
      const f = p1 === p0 ? 1 : (p - p0) / (p1 - p0);
      return v0 + (v1 - v0) * f;
    }
  }
  return rest;
}

const REST = 0.08; // deliberately dark, so the band has somewhere to travel through

export const ENVELOPES: Record<EnvelopeName, Envelope> = {
  /** the reference comet: fast rise, six-stop decay, long dark tail */
  comet: {
    stops: [
      [0, REST],
      [0.08, 1],
      [0.16, 0.64],
      [0.24, 0.44],
      [0.32, 0.24],
      [0.4, REST],
    ],
    rest: REST,
  },
  /**
   * A ring is wide, so the band has to be short in time or it swallows the field.
   *
   * The rise at the front is deliberate and not a rounding artefact: born at full
   * brightness the crest steps from REST to 1 across the seam once per cycle, and
   * the eye reads that step as a twitch rather than a wave.
   */
  wave: {
    stops: [
      [0, REST],
      [0.04, 1],
      [0.1, 1],
      [0.17, 0.5],
      [0.22, REST],
    ],
    duty: 0.22,
    rest: REST,
  },
  /** a soft global pulse — the "breathing" read */
  breathe: {
    stops: [
      [0, 0.24],
      [0.5, 1],
      [1, 0.24],
    ],
    rest: 0.24,
  },
  /**
   * A PLATEAU rather than a comet: the level is held across the middle of the band
   * instead of falling straight through it. With a large dot this reads as a mass
   * swelling and settling — a morph — where a comet reads as a bead travelling
   * however fat the bead is.
   */
  plateau: {
    stops: [
      [0, 0.18],
      [0.2, 0.88],
      [0.45, 1],
      [0.62, 0.88],
      [0.82, 0.18],
    ],
    rest: 0.18,
  },
  /**
   * A chasing crest: a fast rise, then a DECAY, so the ring carries a lit tail behind
   * the high point instead of a shelf edge.
   *
   * This used to be `steps: 3` — three hard brightness values over the band. That is the
   * one thing this file's own rule forbids ("never quantise brightness into shelves"), and
   * it is why `chasing` read as unsmooth: the entire motion had three levels, so every
   * cell crossing a shelf jumped, and with `spread: 0.34` across a ring several cells
   * crossed one in the same frame. Measured, it had 3 distinct brightness levels across a
   * cycle where `comet` had 78.
   *
   * The rise is still faster than the fall, because a chase is defined by its leading
   * edge. But the fall is piecewise-linear over several stops, so the tail is a gradient
   * and neighbouring dots differ by an amount you can see rather than by a cliff.
   */
  chase: {
    duty: 0.46,
    stops: [
      [0, 0.16],
      [0.07, 1],
      [0.16, 0.72],
      [0.26, 0.48],
      [0.36, 0.28],
      [0.46, 0.16],
    ],
    rest: 0.16,
  },
  /**
   * A travelling gaussian for the moving-highlight arm. `duty` is where the band
   * ends — the gaussian is symmetric about p=0, so without it the tail never quite
   * reaches zero and the field stays faintly lit.
   */
  spike: { gauss: 0.006, duty: 0.2, stops: [[0, 1]], rest: 0 },
};

export const ENVELOPE_KEYS = Object.keys(ENVELOPES) as EnvelopeName[];

/** brightness for one cell at phase p */
export function level(p: number, env: Envelope): number {
  if (env.duty != null && p > env.duty) return env.rest;
  if (env.gauss) {
    const d = Math.min(p, 1 - p);
    return Math.exp(-(d * d) / env.gauss);
  }
  return clamp01(envelope(p, env.stops, env.rest));
}

/**
 * The same envelope, stretched along the TIME axis.
 *
 * This is the knob behind "100% → 95% → 85% instead of one cliff". How much two
 * neighbouring dots differ is
 *
 *     neighbour step  =  (d level / d p)  x  (stagger / cell count)
 *
 * so the falloff between neighbours is the RATIO of the wave's own ramp width to
 * the stagger per dot. `stagger` cannot fix smoothness on its own: turning it down
 * to make neighbours agree also stops the wave travelling. Stretching the envelope
 * widens the ramp and leaves the travel alone, which is the only way to get both.
 *
 * Stretching, not blurring. A box blur wide enough to soften a step is also wider
 * than any plateau narrower than itself, so it dissolves the crest of a short
 * envelope into a flat smear; widening the ramp keeps the crest at exactly `peak`
 * and the floor at exactly `rest`, and cuts the neighbour step by the stretch
 * factor. (A blur also has to wrap its samples, and a wrapped window drags the
 * crest across the seam — manufacturing a cliff that gets WORSE as softness rises.)
 *
 * The stretch is capped so the band can never swallow the cycle: a wave with no
 * dark tail stops reading as a wave.
 */
export function stretched(env: Envelope, soft: number): Envelope | null {
  if (!(soft > 0)) return null;
  if (env.gauss) return null; // already smooth: a gaussian has no corner to widen
  const cache = (env as { _stretched?: { soft: number; env: Envelope } })._stretched;
  if (cache && cache.soft === soft) return cache.env;
  const k = 1 + soft * 2;
  const span = env.duty != null ? env.duty : env.stops[env.stops.length - 1]![0];
  const limit = 0.92;
  const kk = span * k > limit ? limit / span : k;
  const out: Envelope = {
    ...env,
    stops: env.stops.map(([p, v]) => [p * kk, v] as const),
    duty: env.duty != null ? Math.min(limit, env.duty * kk) : null,
  };
  (env as { _stretched?: { soft: number; env: Envelope } })._stretched = { soft, env: out };
  return out;
}

/** the envelope at phase p, with its ramp stretched by `soft` */
export function softLevel(p: number, env: Envelope, soft: number): number {
  const e = stretched(env, soft);
  return e ? clamp01(level(p, e)) : level(p, env);
}

/** the phase of a cell: where it sits in the cycle at time t */
export function phaseFor(t: number, order: number, spread: number, speed: number): number {
  return frac(t * speed - order * spread);
}
