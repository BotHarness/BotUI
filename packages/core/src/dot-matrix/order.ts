import type { Order, OrderFn } from "../types.js";

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

/** the boustrophedon cells: down a column, back up the next (or its transpose) */
export function snakePath(cols: number, rows: number, columnMajor: boolean): [number, number][] {
  const out: [number, number][] = [];
  if (columnMajor) {
    for (let c = 0; c < cols; c++) {
      for (let k = 0; k < rows; k++) out.push([c, c % 2 ? rows - 1 - k : k]);
    }
  } else {
    for (let r = 0; r < rows; r++) {
      for (let k = 0; k < cols; k++) out.push([r % 2 ? cols - 1 - k : k, r]);
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
export function spiralPath(cols: number, rows: number): [number, number][] {
  if (cols !== rows || cols < 3) return snakePath(cols, rows, true);
  const key = `${cols}x${rows}`;
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
    // the four edges, with the corners emitted exactly once
    for (let c = lo; c <= hi; c++) at(c, lo);
    for (let r = lo + 1; r <= hi; r++) at(hi, r);
    for (let c = hi - 1; c >= lo; c--) at(c, hi);
    for (let r = hi - 1; r >= lo + 1; r--) at(lo, r);
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
): number {
  const i = columnMajor
    ? col * rows + (col % 2 ? rows - 1 - row : row)
    : row * cols + (row % 2 ? cols - 1 - col : col);
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

export const ORDERS: Record<Order, OrderFn> = {
  /** inward spiral — correct on a rectangle, not just a square */
  spiral: (col, row, cols, rows) => {
    const path = spiralPath(cols, rows);
    for (let i = 0; i < path.length; i++) {
      if (path[i]![0] === col && path[i]![1] === row)
        return path.length > 1 ? i / (path.length - 1) : 0;
    }
    return 0;
  },
  /** row-major snake: left→right, then right→left, and so on */
  snake: (col, row, cols, rows) => snakeIndex(col, row, cols, rows, false),
  /**
   * column-major snake: the one a 2-column grid actually wants. Down the first
   * column, back up the second — a loop with no jump, which a spiral over a 2×5
   * lattice cannot give you.
   */
  columnSnake: (col, row, cols, rows) => snakeIndex(col, row, cols, rows, true),
  /** anti-diagonal sweep, normalised over the real rectangle */
  diagonal: (col, row, cols, rows) => (cols + rows > 2 ? (col + row) / (cols + rows - 2) : 0),
  /**
   * Concentric rings — Chebyshev distance, so a rectangle gives ellipses.
   *
   * Deliberately QUANTISED, and that is the whole character of the look: on an
   * integer lattice the Chebyshev radius takes only a handful of distinct values
   * (four on a 7×7), so each ring shares one phase and the field reads as discrete
   * bands — the concentric-LED-panel effect. It cannot be made smooth, because the
   * lattice has no values in between. For a smooth travelling wave use `radial`.
   */
  ring: (col, row, cols, rows) =>
    Math.min(1, Math.max(Math.abs(axis(col, cols)), Math.abs(axis(row, rows)))),
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
  radial: radialAt,
  /** the same geometry, under the name the global-pulse presets use */
  center: radialAt,
  row: (_col, row, _cols, rows) => (rows > 1 ? row / (rows - 1) : 0),
  column: (col, _row, cols) => (cols > 1 ? col / (cols - 1) : 0),
};

export const ORDER_KEYS = Object.keys(ORDERS) as Order[];

export function orderFor(name: Order): OrderFn {
  return ORDERS[name] ?? ORDERS.spiral;
}
