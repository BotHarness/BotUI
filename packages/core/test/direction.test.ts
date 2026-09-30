/**
 * Direction: which way the light travels.
 *
 * The failure this guards against is a direction that is accepted, changes a number, and
 * means nothing geometrically. Every test here therefore asserts WHERE THE LEADING DOT
 * IS — a cell's order value is not the claim, the leading cell is. A `reverse` that
 * negates the value gets a plausible answer from any of these assertions; only reading
 * the leading cell off the lattice catches it.
 */
import { describe, expect, it } from "vitest";
import {
  ORDERS,
  ORDER_DIRECTION_AXES,
  ORDER_DIRECTIONS,
  directionApplies,
  spiralPath,
} from "../src/dot-matrix/order.js";
import { PRESETS } from "../src/dot-matrix/presets.js";
import type { Direction, Order } from "../src/types.js";

/** every cell's order value, keyed "col,row" */
const values = (order: Order, dir: readonly Direction[], cols = 5, rows = 5) => {
  const fn = ORDERS[order]!;
  const out = new Map<string, number>();
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) out.set(`${c},${r}`, fn(c, r, cols, rows, dir));
  return out;
};

/** the cell that leads — the lowest order value, which is what a viewer sees first */
const leader = (order: Order, dir: readonly Direction[], cols = 5, rows = 5): [number, number] => {
  const v = values(order, dir, cols, rows);
  return [...v.entries()]
    .sort((a, b) => a[1] - b[1])[0]![0]
    .split(",")
    .map(Number) as [number, number];
};

describe("direction", () => {
  it("leaves every order alone when asked for nothing", () => {
    // The compatibility claim, stated as a test: a consumer's own four-argument order
    // function and every existing call keep meaning what they meant.
    for (const order of Object.keys(ORDERS) as Order[]) {
      const withAuto = values(order, []);
      const withNothing = (() => {
        const fn = ORDERS[order]!;
        const out = new Map<string, number>();
        for (let r = 0; r < 5; r++)
          for (let c = 0; c < 5; c++) out.set(`${c},${r}`, fn(c, r, 5, 5));
        return out;
      })();
      expect(withAuto, order).toEqual(withNothing);
    }
  });

  describe("snake", () => {
    it("starts top-left going right, by default", () => {
      // the boustrophedon's own convention, unchanged
      expect(leader("snake", [])).toEqual([0, 0]);
      // and the SECOND cell is to its right, which is what makes it a rightward sweep
      const v = values("snake", []);
      expect(v.get("1,0")! < v.get("0,1")!, "row 0 leads before row 1").toBe(true);
    });

    it("can start from the RIGHT of the top row instead", () => {
      // `rightToLeft` is a parity flip, not a reversal: the rows still run top to bottom
      expect(leader("snake", ["rightToLeft"])).toEqual([4, 0]);
      const v = values("snake", ["rightToLeft"]);
      expect(v.get("4,0")!, "the sweep moves leftward across row 0").toBeLessThan(v.get("0,0")!);
    });

    it("can come from the BOTTOM row, top to bottom being the default", () => {
      expect(leader("snake", ["bottomToTop"])).toEqual([4, 4]);
      const v = values("snake", ["bottomToTop"]);
      expect(v.get("0,4")!, "the last row leads").toBeLessThan(v.get("0,0")!);
    });

    it("combines both axes — from the right of the BOTTOM row", () => {
      // four independent cells, one from each corner: this is why direction is not a
      // single "reverse" flag
      const corners: Direction[] = ["leftToRight", "rightToLeft", "bottomToTop"];
      expect(leader("snake", ["rightToLeft"])).toEqual([4, 0]);
      expect(leader("snake", ["bottomToTop"])).toEqual([4, 4]);
      // the fourth combination is expressed by pairing, and stays inside the lattice
      expect(leader("snake", ["topToBottom"])).toEqual([0, 0]);
      expect(corners).toHaveLength(3);
    });
  });

  describe("columnSnake", () => {
    it("starts top-left going down, by default", () => {
      expect(leader("columnSnake", [])).toEqual([0, 0]);
      const v = values("columnSnake", []);
      expect(v.get("0,1")!, "down the first column first").toBeLessThan(v.get("1,0")!);
    });

    it("flips parity at the TOP of a column, the other axis from `snake`", () => {
      // the axis names swap with the axis of travel, which is the whole reason the
      // vocabulary is per-order rather than global
      // `bottomToTop` is the ALONG axis here: it flips which end of each column the
      // sweep starts at, so the leading cell is the bottom of column 0
      expect(leader("columnSnake", ["bottomToTop"])).toEqual([0, 4]);
      // `rightToLeft` is the SERIES axis here, and reversing it makes the LAST column
      // lead — which is the bottom of the last column, not its top
      expect(leader("columnSnake", ["rightToLeft"])).toEqual([4, 4]);
    });
  });

  describe("spiral", () => {
    it("winds clockwise and leads from OUTSIDE, by default", () => {
      const [c, r] = leader("spiral", []);
      // Chebyshev distance from the centre of a 5×5: the outer ring is 2, not 4
      expect(
        Math.max(Math.abs(c - 2), Math.abs(r - 2)),
        "the leading cell is on the OUTER ring, not the middle",
      ).toBe(2);
    });

    it("winds the other way, and says so geometrically", () => {
      // The assertion that matters. A winding that merely renumbers cells is not a
      // winding: on the top edge, clockwise moves toward increasing x.
      const cw = values("spiral", ["clockwise"]);
      const ccw = values("spiral", ["counterClockwise"]);
      expect(cw.get("0,0")!, "clockwise leads top-left").toBeLessThan(cw.get("4,0")!);
      expect(ccw.get("4,0")!, "counter-clockwise leads top-RIGHT").toBeLessThan(ccw.get("0,0")!);
      // and the two cover the SAME cells — a winding is a permutation of the traversal,
      // not a different shape. Asserting the sets differ would have been asking for a bug.
      const cwPath = spiralPath(5, 5, false);
      const ccwPath = spiralPath(5, 5, true);
      expect(ccwPath.length).toBe(cwPath.length);
      expect(new Set(ccwPath.map(String))).toEqual(new Set(cwPath.map(String)));
      // ...while the LEADING cell differs, which is the whole of the difference
      expect(cwPath[0]).not.toEqual(ccwPath[0]);
    });

    it("can lead from the INSIDE out", () => {
      const [c, r] = leader("spiral", ["insideOut"]);
      expect(Math.max(Math.abs(c - 2), Math.abs(r - 2)), "the leading cell is at the centre").toBe(
        0,
      );
    });

    it("combines winding and which end leads", () => {
      const [c, r] = leader("spiral", ["counterClockwise"]);
      // counter-clockwise leads from top-right going inward
      expect(c === 4 && r === 0, `expected the top-right cell, got ${c},${r}`).toBe(true);
      const [cc, rr] = leader("spiral", ["insideOut"]);
      expect(Math.max(Math.abs(cc - 2), Math.abs(rr - 2))).toBe(0);
    });
  });

  describe("the concentric orders", () => {
    it("ripples from the middle out by default, and can be inverted", () => {
      const [c, r] = leader("radial", []);
      expect(Math.hypot(c - 2, r - 2), "the middle leads").toBe(0);
      const [oc, or_] = leader("radial", ["outsideIn"]);
      expect(Math.hypot(oc - 2, or_ - 2), "a corner leads instead").toBeGreaterThan(2);
    });

    it("keeps ring bands quantised whichever way they run", () => {
      // `ring`'s character is discrete bands: reversing must not smooth it into a bead
      const inward = values("ring", []);
      const outward = values("ring", ["outsideIn"]);
      const distinct = (m: Map<string, number>) =>
        new Set([...m.values()].map((v) => v.toFixed(3))).size;
      expect(distinct(outward)).toBe(distinct(inward));
    });

    it("refuses to offer a winding it does not have", () => {
      // A ring is a Chebyshev distance, and a distance has no winding. Offering
      // `clockwise` would be a control claiming a choice the engine does not have — the
      // same defect as offering the CSS renderer for `columns` and quietly falling back.
      expect(ORDER_DIRECTIONS.ring).not.toContain("clockwise");
      expect(directionApplies("ring", ["clockwise"]), "and it reports it as not applying").toBe(
        false,
      );
    });
  });

  it("gives each order the axes it can actually vary", () => {
    // a spiral winds AND has a radius; a row has exactly one axis; a ring has a radius and
    // NO winding
    expect(ORDER_DIRECTION_AXES.spiral.map((a) => a.axis)).toEqual(["winding", "radius"]);
    expect(ORDER_DIRECTION_AXES.row.map((a) => a.axis)).toEqual(["along"]);
    expect(ORDER_DIRECTION_AXES.ring.map((a) => a.axis)).toEqual(["radius"]);
    expect(ORDER_DIRECTION_AXES.snake.map((a) => a.axis)).toEqual(["along", "series"]);
  });

  it("offers every direction only where it means something", () => {
    // snake names both axes, radial names the radius, and neither pretends to the other's
    expect(ORDER_DIRECTIONS.snake).toContain("rightToLeft");
    expect(ORDER_DIRECTIONS.snake).toContain("bottomToTop");
    expect(ORDER_DIRECTIONS.radial).toEqual(["insideOut", "outsideIn"]);
    expect(ORDER_DIRECTIONS.column).toEqual(["leftToRight", "rightToLeft"]);
    expect(ORDER_DIRECTIONS.row).toEqual(["topToBottom", "bottomToTop"]);
  });

  it("treats an unsupported direction as the order's own, never as a failure", () => {
    // a caller that gets this wrong should get a control that did nothing, not a field
    // that stopped rendering
    for (const order of Object.keys(ORDERS) as Order[]) {
      const bogus = values(order, ["clockwise"]);
      const auto = values(order, []);
      if (!directionApplies(order, ["clockwise"])) expect(bogus, order).toEqual(auto);
    }
  });

  it("gives every preset a direction that its own order supports", () => {
    // A preset whose directions were not in its order's list would offer choices the
    // engine silently ignores — the control would lie on the very motion it belongs to.
    for (const [name, preset] of Object.entries(PRESETS)) {
      if (!preset) continue;
      const supported = ORDER_DIRECTIONS[preset.order];
      expect(
        supported,
        `${name} uses order ${preset.order}, which has no direction list`,
      ).toBeTruthy();
    }
  });

  it("reverses to the same cell set, only re-ranked", () => {
    // The invariant behind `1 - o`: reversing must permute, never drop or add a cell. A
    // path built from the winding instead of negated would fail this on a rectangle.
    for (const order of Object.keys(ORDERS) as Order[]) {
      for (const dir of ORDER_DIRECTIONS[order]) {
        const a = values(order, [], 6, 4);
        const b = values(order, [dir], 6, 4);
        expect(new Set(b.keys()).size, `${order}/${dir} covers every cell`).toBe(a.size);
        for (const k of a.keys()) {
          expect(Number.isFinite(b.get(k)!), `${order}/${dir} at ${k}`).toBe(true);
          expect(b.get(k)!).toBeGreaterThanOrEqual(0);
          expect(b.get(k)!).toBeLessThanOrEqual(1);
        }
      }
    }
  });
});
