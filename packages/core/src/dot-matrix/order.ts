import type { Direction, Order, OrderFn } from "../types.js";

/**
 * Orders are defined on the ACTUAL cols×rows lattice, never on a square of
 * max(cols, rows). That square was the original sin: on a 2×5 grid the spiral
 * was computed over a 5×5 lattice and the two live columns took whatever
 * fragment of it they happened to cover, so the motion was geometrically
 * meaningless. Every order here is correct for any rectangle.
 *
 * An order is 0…1 along a traversal: 0 leads, 1 trails.
 */

const spiralCache = new Map<string, [number, number][]>();

/**
 * The boustrophedon cells: down a column, back up the next (or its transpose).
 *
 * `flip` swaps which end of the FIRST column/row leads. That is a different axis from
 * reversing the traversal, and both are reachable: a 3-row snake going right-then-left
 * from the top row, and the same snake coming from the right of the top row, are
 * different drawings that a single "reverse" flag could not name.
 */
export function snakePath(
  cols: number,
  rows: number,
  columnMajor: boolean,
  flip = false,
): [number, number][] {
  const out: [number, number][] = [];
  if (columnMajor) {
    for (let c = 0; c < cols; c++) {
      // the parity decides which END of the column the sweep starts at
      const down = flip ? c % 2 === 0 : c % 2 === 1;
      for (let k = 0; k < rows; k++) out.push([c, down ? rows - 1 - k : k]);
    }
  } else {
    for (let r = 0; r < rows; r++) {
      const rightward = flip ? r % 2 === 0 : r % 2 === 1;
      for (let k = 0; k < cols; k++) out.push([rightward ? cols - 1 - k : k, r]);
    }
  }
  return out;
}

/**
 * The cells of a grid in spiral order, ring by ring from the OUTSIDE in.
 *
 * A spiral needs room to turn. On a grid only two cells wide the "rings" come
 * apart into disconnected pieces, so a spiral is not a traversal there at all —
 * which is why the enumeration is restricted to squares, and why everything else
 * falls back to the column snake. That fallback is not a compromise: on a 2×5 or
 * 5×2 field the snake IS the loop a person expects (down one column, back up the
 * next), while a spiral would have to jump.
 */
export function spiralPath(
  cols: number,
  rows: number,
  counterClockwise = false,
): [number, number][] {
  if (cols !== rows || cols < 3) return snakePath(cols, rows, true, counterClockwise);
  // the winding is part of the geometry, not of the caller: a counter-clockwise path is a
  // different list of cells, so it needs its own cache entry
  const key = `${cols}x${rows}:${counterClockwise ? "ccw" : "cw"}`;
  const hit = spiralCache.get(key);
  if (hit) return hit;
  const mid = (cols - 1) / 2;
  const out: [number, number][] = [];
  const seen = new Set<number>();
  const at = (c: number, r: number) => {
    const k = r * cols + c;
    if (!seen.has(k)) {
      seen.add(k);
      out.push([c, r]);
    }
  };
  for (let d = Math.ceil(mid); d >= 0; d--) {
    // ceil for the inner bound, floor for the outer one. Rounding is wrong on an
    // EVEN grid: at 4×4 the middle is 1.5, and Math.round(2.5) = 3 would make the
    // inner ring span 1..3 — a ring wider than the grid.
    const lo = Math.max(0, Math.ceil(mid - d));
    const hi = Math.min(cols - 1, Math.floor(mid + d));
    if (lo > hi) continue; // an even grid has no single centre cell
    // The four edges, with the corners emitted exactly once. In screen coordinates
    // (y down) this order runs right along the top, down the right side, left along the
    // bottom, and up the left — clockwise. Counter-clockwise walks the same four edges in
    // the opposite rotational direction; emitting them in reverse is not enough on its own,
    // because each edge's own direction has to reverse with it.
    if (counterClockwise) {
      for (let c = hi; c >= lo; c--) at(c, lo);
      for (let r = lo + 1; r <= hi; r++) at(lo, r);
      // `lo + 1` and not `lo`: (lo, hi) was the left edge's last cell, and the bottom-right
      // corner (hi, hi) is this edge's responsibility — leaving either out silently drops
      // cells, which is how a "counter-clockwise" spiral ends up with two holes in it
      for (let c = lo + 1; c <= hi; c++) at(c, hi);
      for (let r = hi - 1; r > lo; r--) at(hi, r);
    } else {
      for (let c = lo; c <= hi; c++) at(c, lo);
      for (let r = lo + 1; r <= hi; r++) at(hi, r);
      for (let c = hi - 1; c >= lo; c--) at(c, hi);
      for (let r = hi - 1; r >= lo + 1; r--) at(lo, r);
    }
  }
  spiralCache.set(key, out);
  return out;
}

/** the boustrophedon index: down a column, up the next (and its transpose) */
function snakeIndex(
  col: number,
  row: number,
  cols: number,
  rows: number,
  columnMajor: boolean,
  flipParity = false,
): number {
  // Which end of the column/row the sweep starts at. Even-numbered ones run down/right,
  // odd ones run back up/left; `flipParity` swaps which set of columns leads, which is a
  // different axis from reversing the traversal as a whole.
  const down = flipParity ? col % 2 === 0 : col % 2 === 1;
  const rightward = flipParity ? row % 2 === 0 : row % 2 === 1;
  const i = columnMajor
    ? col * rows + (down ? rows - 1 - row : row)
    : row * cols + (rightward ? cols - 1 - col : col);
  return i / Math.max(1, cols * rows - 1);
}

/** the normalised distance from the middle, on one axis */
function axis(col: number, count: number): number {
  return count > 1 ? (col - (count - 1) / 2) / ((count - 1) / 2) : 0;
}

/** the Euclidean radius of a lattice point, normalised — the CONTINUOUS radial ramp */
function radialAt(col: number, row: number, cols: number, rows: number): number {
  return Math.min(1, Math.hypot(axis(col, cols), axis(row, rows)) / Math.SQRT2);
}

/**
 * One traversable axis of an order: the two ends the light can run between.
 *
 * This is the contract the control is built from, and it lives here rather than in a UI
 * because a direction an order cannot express must not be OFFERABLE. `clockwise` on a
 * concentric ring would be a control claiming a choice the engine does not have: a ring
 * is a Chebyshev distance, and a distance has no winding. Offering it is the same defect
 * as offering the CSS renderer for `columns` and quietly falling back.
 *
 * `forward` is the axis's own default, so an empty `direction` list means exactly what it
 * means today. Only the axes an order genuinely has appear: a spiral winds AND has a
 * radius, a snake has a direction-along and a series-order, a row has one axis.
 */
export interface DirectionAxis {
  /**
   * What the axis controls, for a control to label it. `along` is the direction of travel,
   * `series` the order things are visited in, `winding` the rotational sense, `radius`
   * which end leads.
   */
  axis: "along" | "series" | "winding" | "radius";
  forward: Direction;
  backward: Direction;
}

export const ORDER_DIRECTION_AXES: Record<Order, DirectionAxis[]> = {
  spiral: [
    { axis: "winding", forward: "clockwise", backward: "counterClockwise" },
    { axis: "radius", forward: "outsideIn", backward: "insideOut" },
  ],
  // a snake has both a direction-along and a series-order, and they are independent: the
  // four corner choices are four distinct drawings
  snake: [
    { axis: "along", forward: "leftToRight", backward: "rightToLeft" },
    { axis: "series", forward: "topToBottom", backward: "bottomToTop" },
  ],
  columnSnake: [
    { axis: "along", forward: "topToBottom", backward: "bottomToTop" },
    { axis: "series", forward: "leftToRight", backward: "rightToLeft" },
  ],
  // a diagonal sweep advances in x whichever way it runs, so `along` is the axis named
  diagonal: [{ axis: "along", forward: "leftToRight", backward: "rightToLeft" }],
  // no winding: a ring is a distance, not a walk around a circle
  ring: [{ axis: "radius", forward: "insideOut", backward: "outsideIn" }],
  radial: [{ axis: "radius", forward: "insideOut", backward: "outsideIn" }],
  center: [{ axis: "radius", forward: "insideOut", backward: "outsideIn" }],
  row: [{ axis: "along", forward: "topToBottom", backward: "bottomToTop" }],
  column: [{ axis: "along", forward: "leftToRight", backward: "rightToLeft" }],
};

/** every token an order accepts, flattened from its axes — the one source of truth */
export const ORDER_DIRECTIONS: Record<Order, Direction[]> = Object.fromEntries(
  (Object.keys(ORDER_DIRECTION_AXES) as Order[]).map((k) => [
    k,
    ORDER_DIRECTION_AXES[k].flatMap((a) => [a.forward, a.backward]),
  ]),
) as Record<Order, Direction[]>;

/** the requested tokens as a set; an omitted or empty list means the order's own direction */
function asked(direction: readonly Direction[] | undefined): ReadonlySet<Direction> {
  return new Set(direction ?? []);
}

/**
 * Reverse the traversal, i.e. the reading that 0 now leads what used to trail.
 *
 * Negating the order is the WHOLE of this for every order whose geometry is a single
 * monotone ramp, and it is exactly reversible: applying it twice is the identity. The
 * winding token is NOT here, because reversing a spiral's value leaves it winding the same
 * way — which is the point, since `insideOut` and `counterClockwise` are separate axes.
 */
const rev = (o: number, reverse: boolean) => (reverse ? 1 - o : o);

export const ORDERS: Record<Order, OrderFn> = {
  /**
   * Spiral. Rings from the OUTSIDE in, clockwise, by default.
   *
   * `insideOut` needs no second path: the enumeration already lists the outer ring first,
   * so negating the value makes the last-enumerated cell — the innermost — lead, which IS
   * the inner-to-outer traversal. Only the winding has to change the cell list.
   */
  spiral: (col, row, cols, rows, dir) => {
    const d = asked(dir);
    const path = spiralPath(cols, rows, d.has("counterClockwise"));
    for (let i = 0; i < path.length; i++) {
      if (path[i]![0] === col && path[i]![1] === row) {
        const o = path.length > 1 ? i / (path.length - 1) : 0;
        return rev(o, d.has("insideOut"));
      }
    }
    return 0;
  },
  /** row-major snake: left→right, then right→left, and so on */
  snake: (col, row, cols, rows, dir) => {
    const d = asked(dir);
    // `rightToLeft` flips WHICH END OF EACH ROW the sweep starts at; `bottomToTop`
    // reverses which row leads. Different axes, so different mechanisms.
    return rev(snakeIndex(col, row, cols, rows, false, d.has("rightToLeft")), d.has("bottomToTop"));
  },
  /**
   * column-major snake: the one a 2-column grid actually wants. Down the first
   * column, back up the second — a loop with no jump, which a spiral over a 2×5
   * lattice cannot give you.
   *
   * The SAME token names the opposite axis, because the token is relative to the motion:
   * here the travel runs down a column, so `bottomToTop` is the along-axis, and the
   * series-order across columns is `rightToLeft`.
   */
  columnSnake: (col, row, cols, rows, dir) => {
    const d = asked(dir);
    return rev(snakeIndex(col, row, cols, rows, true, d.has("bottomToTop")), d.has("rightToLeft"));
  },
  /** anti-diagonal sweep, normalised over the real rectangle */
  diagonal: (col, row, cols, rows, dir) =>
    rev(cols + rows > 2 ? (col + row) / (cols + rows - 2) : 0, asked(dir).has("rightToLeft")),
  /**
   * Concentric rings — Chebyshev distance, so a rectangle gives ellipses.
   *
   * Deliberately QUANTISED, and that is the whole character of the look: on an
   * integer lattice the Chebyshev radius takes only a handful of distinct values
   * (four on a 7×7), so each ring shares one phase and the field reads as discrete
   * bands — the concentric-LED-panel effect. It cannot be made smooth, because the
   * lattice has no values in between. For a smooth travelling wave use `radial`.
   */
  ring: (col, row, cols, rows, dir) =>
    rev(
      Math.min(1, Math.max(Math.abs(axis(col, cols)), Math.abs(axis(row, rows)))),
      asked(dir).has("outsideIn"),
    ),
  /**
   * Radial from the middle, elliptical on a rectangle, and CONTINUOUS.
   *
   * The Euclidean radius of an integer lattice point is almost never a fraction of
   * anything, so unlike `ring` this gives nearly every dot its own value. That is
   * what a smooth travelling wave needs: the envelope decides how fast the level
   * falls, but if the order only hands out four levels then the field is four bands
   * no matter how smooth the envelope is. With a continuous order the neighbour
   * step becomes (ramp width) / (stagger per dot), and `softness` can reach it.
   */
  radial: (col, row, cols, rows, dir) =>
    rev(radialAt(col, row, cols, rows), asked(dir).has("outsideIn")),
  /** the same geometry, under the name the global-pulse presets use */
  center: (col, row, cols, rows, dir) =>
    rev(radialAt(col, row, cols, rows), asked(dir).has("outsideIn")),
  row: (_col, row, _cols, rows, dir) =>
    rev(rows > 1 ? row / (rows - 1) : 0, asked(dir).has("bottomToTop")),
  column: (col, _row, cols, _rows, dir) =>
    rev(cols > 1 ? col / (cols - 1) : 0, asked(dir).has("rightToLeft")),
};

/**
 * The directions an order honours, so a control can offer only real choices.
 *
 * An unknown order name falls back to the spiral's set rather than to an empty list: a
 * caller that gets this wrong should see the same directions the fallback order has, not
 * a control with nothing in it.
 */
export function directionsFor(name: Order): Direction[] {
  return ORDER_DIRECTIONS[name] ?? ORDER_DIRECTIONS.spiral;
}

/**
 * Whether every requested direction MEANS something for an order.
 *
 * An unsupported token falls back to the order's own direction rather than throwing: that
 * is a mistake in a caller's UI, and the failure should be a control that did nothing,
 * never a field that stopped rendering.
 */
export function directionApplies(
  order: Order,
  direction: readonly Direction[] | undefined,
): boolean {
  const supported = directionsFor(order);
  return (direction ?? []).every((d) => supported.includes(d));
}

export const ORDER_KEYS = Object.keys(ORDERS) as Order[];

export function orderFor(name: Order): OrderFn {
  return ORDERS[name] ?? ORDERS.spiral;
}
