// @vitest-environment jsdom
/**
 * A caller's own traversal.
 *
 * This is the seam the layered design leaves open — which dot leads is one function of
 * lattice position — and a seam is only real if BOTH renderers use it. Every test here
 * exists because the failure mode is not a crash: a custom traversal that reaches the SVG
 * path and is quietly ignored by the CSS one produces a field that is correct in one
 * renderer and wrong in the other, which is exactly the pair of renderers that are supposed
 * to be unable to disagree.
 */
import { describe, expect, it } from "vitest";
import {
  buildCss,
  createDotMatrix,
  field,
  resolveField,
  resolveOptions,
  type DotMatrixOptions,
  type OrderFn,
} from "../src/index.js";

/** a traversal nothing in the library happens to implement: distance from the top-left */
const fromCorner: OrderFn = (col, row, cols, rows) =>
  cols * rows > 1 ? (col + row) / (cols * rows - 1) : 0;

/** the leading cell of a rendered field, by its lattice address */
const leader = (options: DotMatrixOptions) => {
  const f = field({ cols: 4, rows: 4, silhouette: "square", renderer: "svg", ...options }, 0);
  const top = f.reduce((a, b) => (b.order < a.order ? b : a));
  return `${top.col},${top.row}`;
};

describe("a caller's own traversal", () => {
  it("replaces the preset's, rather than adding to it", () => {
    const custom = field({ cols: 5, rows: 5, order: fromCorner, renderer: "svg" }, 0);
    const preset = field({ cols: 5, rows: 5, renderer: "svg" }, 0);
    // `field()` rounds to 4 places for the public record, so the comparison does too —
    // otherwise this asserts the ROUNDING rather than the traversal
    const r4 = (n: number) => Math.round(n * 1e4) / 1e4;
    expect(custom.map((d) => d.order)).toEqual(
      custom.map((d) => r4(fromCorner(d.col, d.row, 5, 5))),
    );
    expect(custom.map((d) => d.order)).not.toEqual(preset.map((d) => d.order));
  });

  it("reaches the CSS renderer, which is the default one", () => {
    // The whole reason this is a test and not a comment: the CSS host bakes `--botui-o`
    // into each cell, so an order the engine forgot to apply would produce two renderers
    // that disagree — the exact failure this library is arranged to make impossible.
    // `square` explicitly: the default is `circle`, which keeps 13 of 25 cells, and a
    // comparison against a full lattice would then be comparing different grids
    const host = buildCss({
      cols: 5,
      rows: 5,
      silhouette: "square",
      order: fromCorner,
      renderer: "css",
    })!;
    const got = [...host.children].map((c) =>
      Number((c as HTMLElement).style.getPropertyValue("--botui-o")),
    );
    // `--botui-o` is written with three decimals by the host, so compare at that precision
    expect(got).toEqual(
      [...Array(25)].map((_, i) => Number(fromCorner(i % 5, Math.floor(i / 5), 5, 5).toFixed(3))),
    );
  });

  it("moves the LIGHT, not just the numbers", () => {
    // A traversal that is merely different is not necessarily a different motion. This one
    // leads at the top-left corner, where the default leads at the middle of a spiral.
    expect(leader({ order: fromCorner }), "leads at a corner").toBe("0,0");
  });

  it("is optional, and absent means the preset's own", () => {
    const withNone = field({ cols: 5, rows: 5, renderer: "svg" }, 0);
    const withUndefined = field({ cols: 5, rows: 5, order: undefined, renderer: "svg" }, 0);
    expect(withNone.map((d) => d.order)).toEqual(withUndefined.map((d) => d.order));
    // and the preset still supplies one
    expect(resolveField({ cols: 5, rows: 5 })!.order).toBeTypeOf("function");
    expect(resolveField({ cols: 5, rows: 5, order: fromCorner })!.order).toBe(fromCorner);
  });

  it("receives `direction`, and a four-argument function simply ignores it", () => {
    // Both shapes are legal: a traversal with no sense of direction should not be forced to
    // accept a parameter, and one that does should not have to re-derive it.
    const five: OrderFn = (col, _row, cols, _rows, dir) =>
      dir?.includes("rightToLeft") ? 1 - col / (cols - 1) : col / (cols - 1);
    const four: OrderFn = (col, _row, cols) => col / (cols - 1);

    /**
     * Which end of a single row LEADS — read from the traversal value, not from the
     * brightest dot. The two are not the same question: brightness also depends on where
     * the cycle happens to be, so at any one frame the leading cell need not be the
     * brightest one.
     */
    const leadsAt = (fn: OrderFn, dir: DotMatrixOptions["direction"]) => {
      const f = field(
        { cols: 5, rows: 1, silhouette: "square", order: fn, direction: dir, renderer: "svg" },
        0,
      );
      return f.reduce((a, b) => (b.order < a.order ? b : a)).col;
    };

    expect(leadsAt(five, []), "left by default").toBe(0);
    expect(leadsAt(five, ["rightToLeft"]), "a five-argument traversal can act on it").toBe(4);
    expect(leadsAt(four, ["rightToLeft"]), "a four-argument one ignores it").toBe(0);
  });

  it("is re-ranked when it changes on a LIVE CSS host", () => {
    // The host bakes `--botui-o` into each cell once. `set()` re-ranks in place, which only
    // works if the re-rank reads the CURRENT traversal — so this drives the real
    // `createDotMatrix`, not `buildCss`, because the failure is a stale host and a stale
    // host is a lifecycle question.
    const element = document.createElement("div");
    const dm = createDotMatrix(element, {
      cols: 4,
      rows: 4,
      silhouette: "square",
      renderer: "css",
      order: fromCorner,
    });
    const read = () =>
      [...element.querySelectorAll(".botui-dot-matrix > i")].map((c) =>
        (c as HTMLElement).style.getPropertyValue("--botui-o"),
      );
    expect(read()[0], "leads at the corner").toBe("0.000");

    dm.set({ order: (col, row, cols, rows) => 1 - fromCorner(col, row, cols, rows) });
    expect(read()[0], "and the mounted host followed it").toBe("1.000");

    dm.set({ order: undefined });
    expect(read()[0], "and handing control back returns it to the preset's traversal").not.toBe(
      "1.000",
    );
    dm.destroy();
  });

  it("does not appear in a resolved options copy as a default", () => {
    // `resolveOptions` fills in everything else, and filling THIS in would mean inventing a
    // default traversal — one more thing silently overriding the caller.
    expect(resolveOptions({}).order).toBeUndefined();
  });
});
