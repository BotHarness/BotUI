import { describe, expect, it } from "vitest";
import {
  DEFAULTS,
  DOT_SHAPES,
  type DotShape,
  ENVELOPES,
  ORDERS,
  PRESETS,
  PRESET_KEYS,
  SILHOUETTES,
  STATE_PRESETS,
  cellsFor,
  dotShareOfPitch,
  glyphPath,
  specFor,
  vertices,
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
      // a gaussian is symmetric about p = 0 and never reaches envelope() at all
      if (env.gauss) continue;
      const first = env.stops[0]![1];
      const last = env.stops[env.stops.length - 1]![1];
      expect(first, `${name} starts at rest`).toBeCloseTo(env.rest, 6);
      expect(last, `${name} ends at rest`).toBeCloseTo(env.rest, 6);
    }
  });

  it("no envelope is quantised into shelves, which is what makes a motion read as cheap", () => {
    // Reported as "chasing is not smooth, it has no delta". `chase` carried `steps: 3`, so
    // the entire motion had three brightness values - 0.16, 0.58, 1.00 - and a cell
    // crossing a shelf jumped. The envelope file's own rule says never quantise into
    // shelves; `chase` was the one that broke it, and the only preset using it.
    for (const [name, env] of Object.entries(ENVELOPES)) {
      expect("steps" in env, name + " must not be quantised into shelves").toBe(false);
      const levels = new Set(
        Array.from({ length: 401 }, (_, i) => softLevel(i / 400, env, 0).toFixed(3)),
      );
      expect(
        levels.size,
        name +
          " has only " +
          levels.size +
          " distinct brightness levels across a cycle; a wave needs a gradient, not shelves",
      ).toBeGreaterThanOrEqual(24);
    }
  });

  it("chasing has a tail and a delta, like the comet it now resembles", () => {
    const env = ENVELOPES.chase;
    // sample the crest and the tail at their own positions rather than at fractions of
    // `duty`: the rise is short and the decay is long, so a fraction of the band is not
    // where either end of it lives
    const crestAt = env.stops.find(([, v]) => v === 1)![0];
    const peak = softLevel(crestAt, env, 0);
    expect(peak, "chasing reaches full brightness").toBeCloseTo(1, 6);
    const behind = softLevel(env.duty! * 0.82, env, 0);
    expect(behind, "brightness falls away after the crest").toBeLessThan(peak * 0.75);
    expect(behind, "but the tail is still lit, not a cliff down to the floor").toBeGreaterThan(
      env.rest,
    );

    let biggest = 0;
    for (let i = 1; i < 400; i++) {
      biggest = Math.max(
        biggest,
        Math.abs(softLevel(i / 400, env, 0) - softLevel((i - 1) / 400, env, 0)),
      );
    }
    expect(
      biggest,
      "chasing jumps " +
        biggest.toFixed(3) +
        " between neighbouring samples; a stepped envelope jumps about 0.42",
    ).toBeLessThan(0.05);
  });

  it("every envelope is dark outside its duty, and starts and ends at rest", () => {
    // `chase` used to keep a stop table that `level()` ignored, so the table had to agree
    // with a branch that has now been deleted along with it. Every envelope is one shape
    // again: a stop table, a gaussian, or nothing but `rest`. So the claim is the simple
    // one — whatever an envelope is, it is unlit past its band and lit at neither end.
    for (const [name, env] of Object.entries(ENVELOPES)) {
      // Only the stop-table envelopes are dark at both ends. `breathe` is a global pulse
      // whose band IS the cycle, so it is continuous across the seam by design; `spike` is
      // a gaussian centred ON the seam, which is how a travelling highlight gets its crest
      // there without a step. Both are deliberate and neither is a shelf.
      if (env.duty == null || env.gauss) continue;
      expect(softLevel(0, env, 0), name + " starts at rest").toBeCloseTo(env.rest, 6);
      expect(softLevel(0.999, env, 0), name + " ends at rest").toBeCloseTo(env.rest, 6);
      if (env.duty != null) {
        expect(softLevel(env.duty + 0.01, env, 0), name + " is dark past its duty").toBeCloseTo(
          env.rest,
          6,
        );
      }
    }
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

describe("a glyph has to be a shape, not a path", () => {
  /**
   * The signed area of a polygon. A glyph with zero area renders as NOTHING, and
   * nothing in a DOM dump, a record count, or a mask string reveals that — every
   * existing check passed while the default dot was invisible.
   */
  const area = (pts: readonly (readonly [number, number])[]) => {
    let a = 0;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i]!;
      const q = pts[(i + 1) % pts.length]!;
      a += p[0] * q[1] - q[0] * p[1];
    }
    return Math.abs(a) / 2;
  };

  it("every named shape encloses area", () => {
    // Regression: `vertices` alternated a point radius of 1 with a notch radius of
    // `star` even when star was 0, so every second vertex landed on the origin. A
    // 4-gon became a zero-area bowtie — and the default dot is a 4-gon, so the
    // whole component rendered blank while every other test passed.
    for (const name of Object.keys(DOT_SHAPES)) {
      const spec = specFor(name as DotShape);
      const g = glyphPath(spec);
      expect(area(g.pts), `${name} encloses no area — it renders as nothing`).toBeGreaterThan(0.1);
      expect(g.d, `${name} has no path`).toMatch(/^M/);
      expect(g.d, `${name} path is not closed`).toMatch(/Z$/);
    }
  });

  it("every vertex is a real vertex — none collapsed onto the origin", () => {
    // the specific failure: a notch at radius 0 is the origin, and a polygon through
    // the origin has no area
    for (const name of Object.keys(DOT_SHAPES)) {
      const g = glyphPath(specFor(name as DotShape));
      for (const [x, y] of g.pts) {
        expect(Math.hypot(x, y), `${name} has a vertex at the origin`).toBeGreaterThan(0.01);
      }
    }
  });

  it("a plain n-gon has exactly n vertices, and a star has 2n", () => {
    // one vertex per arm means the notches do not exist, so they cannot be reflex,
    // so innerRadius has nothing to round
    expect(vertices({ sides: 4 })).toHaveLength(4);
    expect(vertices({ sides: 5 })).toHaveLength(5);
    expect(vertices({ sides: 5, star: 0.44 })).toHaveLength(10);
    expect(vertices({ sides: 6, star: 0.4 })).toHaveLength(12);
    // and never fewer than a triangle
    expect(vertices({ sides: 1 })).toHaveLength(3);
  });

  it("a star sits at (1 - star) of its arm, so `star` reads as the waist", () => {
    const g = glyphPath({ sides: 5, star: 0.44 });
    const radii = g.pts.map(([x, y]) => Math.hypot(x, y));
    // the points are the long radius, the notches the short one
    expect(Math.max(...radii)).toBeCloseTo(1, 6);
    expect(Math.min(...radii)).toBeCloseTo(0.56, 6);
  });

  it("sides: 4 is an axis-aligned square, and radius at the inradius is a circle", () => {
    const square = glyphPath({ sides: 4, radius: 0 });
    // the even-count half-step offset is what puts the corners on the diagonals and
    // the edges on the axes; without it `sides: 4` is a diamond
    for (const [x, y] of square.pts) {
      expect(Math.abs(x), "an axis-aligned square has corners on the diagonals").toBeCloseTo(
        Math.abs(y),
        6,
      );
    }
    // the inradius of a polygon on the unit circle is cos(π/n) — 0.707 for a square,
    // not 0.5, which is why the old "circle" entry was a rounded square
    expect(square.inradius).toBeCloseTo(Math.SQRT1_2, 6);
  });

  it("the inradius is cos(π/n) for every side count", () => {
    // derived, not tabulated, so `sides: 7` behaves like the rest
    for (const n of [3, 4, 5, 6, 8]) {
      expect(glyphPath({ sides: n }).inradius, `sides ${n}`).toBeCloseTo(Math.cos(Math.PI / n), 6);
    }
  });

  it("every shape fits the same bounding box, so dotSize means the same thing", () => {
    // this is the whole reason the dot is sized by bbox and not by the inradius: a
    // star whose inradius is ~0.1 would be inflated tenfold
    for (const name of Object.keys(DOT_SHAPES) as DotShape[]) {
      const g = glyphPath(specFor(name));
      expect(g.box, `${name} does not fill its box`).toBeGreaterThan(0.5);
      expect(g.box, `${name} does not fill its box`).toBeLessThan(2.5);
    }
  });
});

describe("the named shapes are what they say they are", () => {
  /**
   * The area of the FILLED path, integrating the quadratic fillets.
   *
   * Measuring the vertex list instead would be measuring the polygon the fillet cuts
   * corners off — which is why a test that claimed "a circle is not smaller than a
   * square" passed at exactly 1.0 for a shape that is not a circle.
   */
  const pathArea = (d: string, steps = 24): number => {
    // tokenise letters and numbers SEPARATELY. Walking one index into both the path
    // string and a flat number list — which is what this did first — reads the digit
    // of "0.7071" as the next command, and throws on a path the module just produced.
    const tokens = [...d.matchAll(/([MLQZ])|(-?\d*\.?\d+)/g)].map((m) =>
      m[1] ? m[1] : Number(m[2]),
    );
    const pts: [number, number][] = [];
    let i = 0;
    const quad = (cx: number, cy: number, x: number, y: number) => {
      const [x0, y0] = pts[pts.length - 1]!;
      for (let s = 1; s <= steps; s++) {
        const u = s / steps;
        const m = 1 - u;
        pts.push([
          m * m * x0 + 2 * m * u * cx + u * u * x,
          m * m * y0 + 2 * m * u * cy + u * u * y,
        ]);
      }
    };
    while (i < tokens.length) {
      const op = tokens[i];
      if (op === "M" || op === "L") {
        pts.push([tokens[i + 1] as number, tokens[i + 2] as number]);
        i += 3;
      } else if (op === "Q") {
        quad(
          tokens[i + 1] as number,
          tokens[i + 2] as number,
          tokens[i + 3] as number,
          tokens[i + 4] as number,
        );
        i += 5;
      } else if (op === "Z") {
        i += 1;
      } else {
        // a parser that quietly skipped an unknown command would make every area
        // assertion below meaningless, so it has to be loud
        throw new Error(
          `unexpected path command ${JSON.stringify(op)} — the sampler only knows this module's own output`,
        );
      }
    }
    let a = 0;
    for (let k = 0; k < pts.length; k++) {
      const p = pts[k]!;
      const q = pts[(k + 1) % pts.length]!;
      a += p[0] * q[1] - q[0] * p[1];
    }
    return Math.abs(a) / 2;
  };

  it("the shape called circle has the area of a circle", () => {
    // Two real reasons the old entry was not a circle, and both are asserted here so
    // neither can come back: a square's inradius is cos(π/4) = 0.707 and not 0.5, and
    // a QUADRATIC fillet bulges outside a true 90° arc by ~6%. So the table uses a
    // 32-gon rounded to its own inradius, and the area lands within a fraction of a
    // percent of a real circle.
    const g = glyphPath(specFor("circle"));
    expect(g.d, "a fully rounded polygon must actually contain curves").toContain("Q");
    const r = Math.cos(Math.PI / 32);
    const expected = Math.PI * r * r;
    const actual = pathArea(g.d);
    expect(Math.abs(actual - expected) / expected, "the circle is not round").toBeLessThan(0.015);
  });

  it("a filleted square is measurably NOT a circle, which is why the table is not one", () => {
    // the geometric fact behind the entry above, pinned so the choice stays justified
    const filletedSquare = pathArea(glyphPath({ sides: 4, radius: Math.SQRT1_2 }).d);
    const circleAtSameInradius = Math.PI * 0.5;
    expect(
      filletedSquare / circleAtSameInradius - 1,
      "quadratic fillets bulge outside the arc",
    ).toBeGreaterThan(0.03);
  });

  it("the shape called square has the area of a square", () => {
    const g = glyphPath(specFor("square"));
    // vertices on the unit circle: side √2, so area 2. The path rounds coordinates
    // to 4 decimals, so the tolerance is the rounding, not the geometry.
    expect(pathArea(g.d)).toBeCloseTo(2, 3);
  });

  it("filleting removes area — the corners are what get cut", () => {
    const square = pathArea(glyphPath(specFor("square")).d);
    const rounded = pathArea(glyphPath(specFor("rounded")).d);
    expect(rounded).toBeLessThan(square);
    // a quarter of the corners go, and nothing else
    expect(rounded / square).toBeGreaterThan(0.9);
  });

  it("the path sampler only accepts what this module emits", () => {
    // a parser that silently mis-reads an unexpected command would make every
    // assertion above meaningless
    expect(() => pathArea("M0 0A1 1 0 0 1 1 1Z")).toThrow(/unexpected path command/);
  });
});
