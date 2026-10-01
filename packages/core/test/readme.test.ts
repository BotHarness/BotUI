/**
 * The examples in the README.
 *
 * A README example that does not compile is worse than no example: it is the first thing
 * a reader runs, and it is the thing they will judge the API by. Both snippets here are
 * lifted verbatim, so they cannot rot independently of the prose describing them.
 */
import { describe, expect, it } from "vitest";
import { field, type OrderFn } from "../src/index.js";

const chevron: OrderFn = (col, row, cols, rows) => {
  const mid = (rows - 1) / 2;
  const arm = Math.abs(row - mid) / (mid || 1);
  const along = col / (cols - 1 || 1);
  const v = arm * 0.6 + along * 0.4;
  return v * v;
};

describe("the README's own traversal", () => {
  it("runs, and produces a traversal rather than a crash", () => {
    // `square` explicitly: the default silhouette is `circle`, which keeps 49 of 81 cells
    const f = field(
      {
        cols: 9,
        rows: 9,
        silhouette: "square",
        preset: "morph",
        order: chevron,
        renderer: "svg",
      },
      0,
    );
    expect(f).toHaveLength(81);
    for (const d of f) {
      expect(d.order, `${d.col},${d.row}`).toBeGreaterThanOrEqual(0);
      expect(d.order).toBeLessThanOrEqual(1);
      expect(Number.isFinite(d.opacity), "and a real brightness").toBe(true);
    }
  });

  it("survives the degenerate grids a reader will paste it into", () => {
    // `mid || 1` and `cols - 1 || 1` are in the snippet precisely because a 1-row or
    // 1-column field divides by zero — the kind of thing that only shows up after somebody
    // has already copied the code.
    for (const [cols, rows] of [
      [1, 1],
      [1, 7],
      [7, 1],
      [3, 3],
      [2, 9],
    ]) {
      const f = field({ cols, rows, silhouette: "square", order: chevron, renderer: "svg" }, 0);
      expect(f.length, `${cols}x${rows}`).toBe(cols * rows);
      expect(
        f.every((d) => Number.isFinite(d.order)),
        `${cols}x${rows}`,
      ).toBe(true);
    }
  });

  it("actually accelerates toward the tips, which is what the prose claims", () => {
    // If the easing were a no-op the example would still run and still look plausible, so
    // the claim in the text has to be checked against the numbers it produces.
    const f = field({ cols: 9, rows: 9, silhouette: "square", order: chevron, renderer: "svg" }, 0);
    const at = (col: number, row: number) => f.find((d) => d.col === col && d.row === row)!.order;
    // down the spine, the value rises; and it rises SLOWLY then FASTLY, which is the ease-in
    const steps = [0, 1, 2, 3].map((c) => at(c, 4) - (c > 0 ? at(c - 1, 4) : 0));
    for (let i = 1; i < steps.length; i++) {
      expect(steps[i]!, `step ${i} is not larger than step ${i - 1}`).toBeGreaterThan(
        steps[i - 1]!,
      );
    }
    expect(at(8, 4), "and the tip is the far end").toBeGreaterThan(at(0, 4));
  });
});
