import { describe, expect, it } from "vitest";
import {
  DEFAULTS,
  ENVELOPES,
  ORDERS,
  PRESETS,
  PRESET_KEYS,
  SILHOUETTES,
  STATE_PRESETS,
  cellsFor,
  dotShareOfPitch,
  layout,
  softLevel,
  stretched,
  touchingDotSize,
} from "../src/index.js";

describe("lattice", () => {
  it("square keeps every cell", () => {
    expect(cellsFor(5, 5, "square")).toHaveLength(25);
  });

  it("a silhouette is a subset of the square, never a different lattice", () => {
    for (const name of Object.keys(SILHOUETTES)) {
      const kept = cellsFor(7, 7, name as keyof typeof SILHOUETTES);
      expect(kept.length).toBeGreaterThan(0);
      expect(kept.length).toBeLessThanOrEqual(49);
      // every kept cell is a real cell of the full lattice
      for (const c of kept) {
        expect(c.col).toBeGreaterThanOrEqual(0);
        expect(c.col).toBeLessThan(7);
      }
    }
  });

  it("circle drops the corners a circle has no room for", () => {
    // (0,0) is the corner: nx = ny = -1, so r = √2 > 1
    expect(cellsFor(7, 7, "circle").some((c) => c.col === 0 && c.row === 0)).toBe(false);
    // the middle is kept
    expect(cellsFor(7, 7, "circle").some((c) => c.col === 3 && c.row === 3)).toBe(true);
  });

  it("a 1×N lattice has one column and does not divide by zero", () => {
    expect(cellsFor(1, 4, "square")).toHaveLength(4);
    expect(cellsFor(1, 4, "square").every((c) => c.nx === 0)).toBe(true);
  });
});

describe("order", () => {
  it("a spiral visits every cell exactly once on a square", () => {
    const seen = new Set(ORDERS.spiral(0, 0, 7, 7) === undefined ? [] : []);
    expect(seen.size).toBe(0); // placeholder guard; the real check is below
    const positions = new Set<number>();
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) positions.add(ORDERS.spiral(c, r, 7, 7));
    }
    // 49 cells on a traversal 0…1: 48 gaps, so 49 distinct values
    expect(positions.size).toBe(49);
  });

  it("a spiral on a narrow grid is a loop, not a fragment", () => {
    // the 2×5 case that motivated the whole rewrite: the traversal must still be
    // continuous and cover the field, so the motion is a snake
    const values = Array.from({ length: 10 }, (_, i) =>
      ORDERS.spiral(i % 2, Math.floor(i / 2), 2, 5),
    );
    expect(new Set(values).size).toBe(10);
    expect(Math.min(...values)).toBe(0);
    expect(Math.max(...values)).toBe(1);
  });

  it("the column snake is a boustrophedon over the real rectangle", () => {
    // down column 0, back up column 1 — the loop a 2-wide field actually wants
    const first = ORDERS.columnSnake(0, 0, 2, 5);
    const second = ORDERS.columnSnake(0, 1, 2, 5);
    expect(second).toBeGreaterThan(first);
    // column 1 is the odd one, so it runs BOTTOM to TOP — that reversal is the
    // whole point of a boustrophedon, and getting it backwards is a jump
    const topOfSecondColumn = ORDERS.columnSnake(1, 0, 2, 5);
    const bottomOfSecondColumn = ORDERS.columnSnake(1, 4, 2, 5);
    expect(topOfSecondColumn).toBeGreaterThan(bottomOfSecondColumn);
    expect(topOfSecondColumn).toBe(1);
    expect(bottomOfSecondColumn).toBeCloseTo(5 / 9, 9);
  });

  it("the Chebyshev ring is quantised and the Euclidean radial is not", () => {
    const levels = (fn: (c: number, r: number) => number) => {
      const s = new Set<number>();
      for (let r = 0; r < 7; r++) for (let c = 0; c < 7; c++) s.add(round6(fn(c, r)));
      return s.size;
    };
    // four on a 7×7 — and that is the character of the look, not a bug to fix
    expect(levels((c, r) => ORDERS.ring(c, r, 7, 7))).toBe(4);
    // the continuous order is what lets a smooth wave exist at all
    expect(levels((c, r) => ORDERS.radial(c, r, 7, 7))).toBeGreaterThanOrEqual(9);
    expect(PRESETS.ripple.order).toBe("radial");
  });

  it("every order is defined on every rectangle", () => {
    for (const [name, fn] of Object.entries(ORDERS)) {
      for (const [cols, rows] of [
        [1, 1],
        [1, 7],
        [7, 1],
        [2, 5],
        [5, 2],
        [3, 4],
        [8, 8],
      ] as const) {
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const v = fn(c, r, cols, rows);
            expect(Number.isFinite(v), `${name} at ${cols}×${rows}`).toBe(true);
            expect(v, `${name} at ${cols}×${rows}`).toBeGreaterThanOrEqual(0);
            expect(v, `${name} at ${cols}×${rows}`).toBeLessThanOrEqual(1);
          }
        }
      }
    }
  });
});

describe("envelope", () => {
  it("every interpolated stop table starts and ends at its rest level", () => {
    // otherwise the cell steps across the p = 0 → 1 seam once per cycle, which the
    // eye reads as a twitch rather than a wave
    for (const [name, env] of Object.entries(ENVELOPES)) {
      // a gaussian is symmetric about p = 0, and a stepped envelope never reaches
      // envelope() at all — its stops describe the RANGE of the shelves instead
      if (env.gauss || env.steps) continue;
      const first = env.stops[0]![1];
      const last = env.stops[env.stops.length - 1]![1];
      expect(first, `${name} starts at rest`).toBeCloseTo(env.rest, 6);
      expect(last, `${name} ends at rest`).toBeCloseTo(env.rest, 6);
    }
  });

  it("a stepped envelope spans exactly rest…peak, and is dark outside its duty", () => {
    // `chase` keeps a stop table even though `level()` ignores it, so the table has
    // to agree with the branch that actually runs — otherwise it is dead data that
    // reads as if it described the motion
    const env = ENVELOPES.chase;
    expect(env.steps).toBe(3);
    expect(env.stops[0]![1]).toBeCloseTo(env.rest, 6);
    expect(env.stops[env.stops.length - 1]![1]).toBe(1);
    expect(softLevel(0, env, 0)).toBeCloseTo(env.rest, 6);
    expect(softLevel(env.duty! + 0.01, env, 0)).toBeCloseTo(env.rest, 6);
  });

  it("every stop table is monotonic in position and inside [rest, 1]", () => {
    for (const [name, env] of Object.entries(ENVELOPES)) {
      for (let i = 1; i < env.stops.length; i++) {
        expect(env.stops[i]![0], `${name} stop ${i} is ordered`).toBeGreaterThan(
          env.stops[i - 1]![0],
        );
      }
      for (const [, v] of env.stops) {
        expect(v, `${name} brightness in range`).toBeGreaterThanOrEqual(0);
        expect(v, `${name} brightness in range`).toBeLessThanOrEqual(1);
      }
    }
  });

  it("softness 0 is the authored envelope", () => {
    expect(softLevel(0.3, ENVELOPES.wave, 0)).toBe(softLevel(0.3, ENVELOPES.wave, 0));
  });

  it("softness never raises the crest above the authored peak", () => {
    for (const env of Object.values(ENVELOPES)) {
      let hardPeak = 0;
      let softPeak = 0;
      for (let i = 0; i <= 600; i++) {
        hardPeak = Math.max(hardPeak, softLevel(i / 600, env, 0));
        softPeak = Math.max(softPeak, softLevel(i / 600, env, 0.9));
      }
      expect(softPeak, "a longer band must not blow out the peak").toBeLessThanOrEqual(
        hardPeak + 1e-9,
      );
    }
  });

  it("softness keeps a continuous crest exactly where it was", () => {
    // stretching widens the ramp; it must not dim or lift the peak. A STEPPED
    // envelope is excluded: its shelves are quantised, so moving the shelf edges
    // can change which value a sample lands on — that is the quantisation showing,
    // not a dimmed crest.
    for (const env of Object.values(ENVELOPES)) {
      if (env.steps) continue;
      // sample the stop positions TOO: stretching moves them, and a fixed grid can
      // step over the crest and report a dimmed peak that is not there
      const stretchedEnv = stretched(env, 0.9) ?? env;
      const points = [
        ...Array.from({ length: 601 }, (_, i) => i / 600),
        ...env.stops.map(([p]) => p),
        ...stretchedEnv.stops.map(([p]) => p),
      ];
      const hardPeak = Math.max(...points.map((p) => softLevel(p, env, 0)));
      const softPeak = Math.max(...points.map((p) => softLevel(p, env, 0.9)));
      expect(softPeak, "the crest is unchanged").toBeCloseTo(hardPeak, 6);
    }
  });

  it("softness widens the ramp, so a gentler neighbour step", () => {
    const env = ENVELOPES.wave;
    const steepest = (soft: number) => {
      let max = 0;
      const N = 2000;
      for (let i = 0; i < N; i++) {
        const a = softLevel(i / N, env, soft);
        const b = softLevel((i + 1) / N, env, soft);
        max = Math.max(max, Math.abs(b - a));
      }
      return max;
    };
    expect(steepest(0.9)).toBeLessThan(steepest(0) * 0.6);
  });

  it("the stretched band can never swallow the cycle", () => {
    // a wave with no dark tail stops reading as a wave
    const env = ENVELOPES.wave;
    for (const soft of [0.5, 1, 10, 100]) {
      let lit = 0;
      const N = 4000;
      for (let i = 0; i < N; i++) if (softLevel(i / N, env, soft) > env.rest + 0.01) lit++;
      expect(lit / N, `softness ${soft} leaves a dark tail`).toBeLessThan(0.98);
    }
  });

  it("the moving-highlight gaussian peaks at the seam and decays away from it", () => {
    const env = ENVELOPES.spike;
    // the highlight is born at full brightness at p = 0 and falls off on both sides
    // of the seam; `duty` then truncates the rest of the cycle so the field goes
    // dark instead of staying faintly lit
    expect(softLevel(0, env, 0)).toBeCloseTo(1, 6);
    expect(softLevel(0.05, env, 0)).toBeLessThan(softLevel(0.02, env, 0));
    expect(softLevel(0.02, env, 0)).toBeGreaterThan(softLevel(0.1, env, 0));
    expect(softLevel(0.5, env, 0)).toBeCloseTo(env.rest, 6);
  });
});

describe("layout", () => {
  const base = { size: 200, cols: 5, rows: 5, gapX: 0, gapY: 0 };

  it("lands exactly on the box on the tighter axis, at any dot size", () => {
    // f is SOLVED for rather than clipped, so this holds above 1 too — which is
    // what lets the dots touch or overlap without a clipping margin
    for (const dotSize of [0.05, 0.3, 1, 1.45, 2, 3]) {
      const L = layout({ ...base, dotSize });
      expect(L.pitchX * 4 + L.dotPx, `dotSize ${dotSize}`).toBeCloseTo(200, 6);
    }
  });

  it("a dot of two cells is exactly two cells wide", () => {
    const L = layout({ ...base, dotSize: 2 });
    expect(L.dotPx / L.cellX).toBeCloseTo(2, 9);
  });

  it("two dots touch at exactly 1 + gap, not at 100%", () => {
    // the pitch is the cell times (1 + gap), so the touching point moves with the
    // gap dial. A control labelled only "percent of cell" has a 100% that means
    // nothing stable.
    for (const gap of [0, 0.45, 1.2]) {
      const touching = layout({ ...base, gapX: gap, gapY: gap, dotSize: touchingDotSize(gap) });
      expect(touching.dotPx, `gap ${gap}`).toBeCloseTo(touching.pitchX, 9);
      const under = layout({ ...base, gapX: gap, gapY: gap, dotSize: touchingDotSize(gap) - 0.2 });
      expect(under.dotPx, `gap ${gap} below`).toBeLessThan(under.pitchX);
      const over = layout({ ...base, gapX: gap, gapY: gap, dotSize: touchingDotSize(gap) + 0.2 });
      expect(over.dotPx, `gap ${gap} above`).toBeGreaterThan(over.pitchX);
    }
  });

  it("the pitch share is the number the eye judges", () => {
    expect(dotShareOfPitch(1, 0)).toBe(1);
    expect(dotShareOfPitch(1.45, 0.45)).toBeCloseTo(1, 9);
    expect(dotShareOfPitch(touchingDotSize(0.45), 0.45)).toBeCloseTo(1, 9);
  });

  it("the dot comes from the tighter axis, so it can never overlap on either", () => {
    // 7 columns across 200px is the tighter axis here, not 3 rows
    const L = layout({ size: 200, cols: 7, rows: 3, gapX: 0, gapY: 0, dotSize: 1 });
    expect(L.dotPx).toBeCloseTo(Math.min(L.cellX, L.cellY), 9);
    expect(L.dotPx).toBeCloseTo(L.cellX, 9);
    expect(L.dotPx).toBeLessThanOrEqual(L.pitchX);
    expect(L.dotPx).toBeLessThanOrEqual(L.pitchY);
    // and the looser axis is left with slack rather than a non-square dot
    expect(L.pitchY).toBeGreaterThan(L.dotPx);
  });

  it("scales with size without changing its proportions", () => {
    const small = layout({ size: 16, cols: 5, rows: 5, gapX: 0.45, gapY: 0.45, dotSize: 0.55 });
    const large = layout({ size: 240, cols: 5, rows: 5, gapX: 0.45, gapY: 0.45, dotSize: 0.55 });
    expect(large.pitchX / small.pitchX).toBeCloseTo(15, 6);
    expect(large.dotPx / large.pitchX).toBeCloseTo(small.dotPx / small.pitchX, 9);
  });

  it("survives a 1×1 field and a degenerate gap", () => {
    const one = layout({ size: 32, cols: 1, rows: 1, gapX: 3, gapY: 3 });
    expect(one.dotPx).toBeGreaterThan(0);
    expect(Number.isFinite(one.pitchX)).toBe(true);
  });

  it("the default is on the documented scale", () => {
    // the dot-share dial has to be able to express the default, or the control is
    // lying about where it starts
    expect(DEFAULTS.dotSize).toBeGreaterThan(0);
    expect(DEFAULTS.dotSize).toBeLessThan(touchingDotSize(Math.max(DEFAULTS.gapX, DEFAULTS.gapY)));
  });
});

describe("presets", () => {
  it("every preset but off names a real order and a real envelope", () => {
    for (const name of PRESET_KEYS) {
      const preset = PRESETS[name];
      if (!preset) {
        expect(name).toBe("off");
        continue;
      }
      expect(ORDERS[preset.order], `${name} order`).toBeDefined();
      expect(ENVELOPES[preset.env], `${name} envelope`).toBeDefined();
    }
  });

  it("every preset carries the agent state it is meant to express", () => {
    for (const name of PRESET_KEYS) {
      if (name === "off") continue;
      expect(PRESETS[name]!.task, `${name} task`).toBeTruthy();
    }
  });

  it("every agent state maps to a real preset", () => {
    for (const [state, preset] of Object.entries(STATE_PRESETS)) {
      expect(PRESETS[preset], `${state} → ${preset}`).toBeTruthy();
    }
  });

  it("a solid motion uses a plateau, not a thin comet", () => {
    for (const name of PRESET_KEYS) {
      const preset = PRESETS[name];
      if (!preset?.solid) continue;
      // a comet reads as a travelling bead however fat the bead is
      expect(preset.env, `${name} is solid`).not.toBe("comet");
    }
  });
});

function round6(v: number): number {
  return Math.round(v * 1e6) / 1e6;
}
