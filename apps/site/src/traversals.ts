import type { OrderFn } from "@botharness/botui-core";

/**
 * Two traversals the library does not ship, written the way a reader would write them.
 *
 * These exist to demonstrate the `order` seam on the page rather than only in a README: a
 * capability nobody can see is a capability that quietly stops working. Both are ordinary
 * `OrderFn`s — a function of lattice position returning `0…1`, where `0` leads.
 *
 * The source of this file is shown verbatim beside the field, imported with `?raw`, so the
 * code a visitor reads cannot drift from the code that is running. A hand-maintained copy
 * of a function is a copy that lies the first time someone edits one of them.
 */

/**
 * A CHEVRON that accelerates toward its tips.
 *
 * "Accelerating" is not a property of the traversal's SHAPE but of how the value is
 * distributed along it: squaring compresses the early differences and stretches the late
 * ones, so successive dots along each arm start closer together in phase near the tip. A
 * linear chevron is a chevron; an eased one is a chevron that moves like it is going
 * somewhere.
 *
 * The value mixes distance from the spine with progress along the field, which is what
 * makes it fold rather than simply translate.
 */
export const chevron: OrderFn = (col, row, cols, rows) => {
  const mid = (rows - 1) / 2;
  // 0 at the spine, 1 at the outer tips. `|| 1` because a single row has no mid to divide by
  const arm = Math.abs(row - mid) / (mid || 1);
  const along = col / (cols - 1 || 1);
  const v = arm * 0.6 + along * 0.4;
  // ease-in
  return v * v;
};

/**
 * RINGS expanding from a dot the visitor chooses.
 *
 * Chebyshev distance — `max(|dc|, |dr|)` — rather than Euclidean, and that choice is the
 * whole character: on an integer lattice the Chebyshev radius takes only a handful of
 * distinct values, so every dot on a ring shares one phase and the field reads as discrete
 * bands. Euclidean would give nearly every dot its own value and turn the same traversal
 * into a smooth travelling wave. The concentric `ring` preset is this function with the
 * origin pinned to the middle; here the origin is a parameter, which is the request the
 * library's own table could not express.
 *
 * Normalised by the largest distance the lattice can hold, so the outermost dot leads at 1
 * whatever the grid size — otherwise a 9×9 and a 3×3 would animate at different rates for
 * the same nominal shape.
 */
export function ringsFrom(origin: { col: number; row: number }): OrderFn {
  return (col, row, cols, rows) => {
    const d = Math.max(Math.abs(col - origin.col), Math.abs(row - origin.row));
    // The furthest cell in the lattice FROM THE ORIGIN, which is whichever corner is
    // diagonally opposite it. Normalising by a fixed denominator — `cols`, or
    // `max(cols, rows)` — is the tempting one-liner and it is wrong twice over: it makes
    // the outermost dot's value depend on the GRID SIZE rather than on the origin, so a
    // 9×9 and a 3×3 animate at different rates for the same nominal shape, and it leaves
    // the last ring short of 1, so the wave never quite arrives.
    const far = Math.max(origin.col, cols - 1 - origin.col, origin.row, rows - 1 - origin.row);
    return far > 0 ? Math.min(1, d / far) : 0;
  };
}

/** the cell nearest a click, so a visitor can pick the origin with a pointer */
export function nearestCell(
  at: { x: number; y: number },
  pitch: { x: number; y: number },
  cols: number,
  rows: number,
): { col: number; row: number } {
  // the field is centred, so a click at (0,0) in field space is the top-left cell
  const cx = (cols - 1) / 2;
  const cy = (rows - 1) / 2;
  const col = Math.round(cx + (at.x / pitch.x) * cx);
  const row = Math.round(cy + (at.y / pitch.y) * cy);
  return {
    col: Math.min(cols - 1, Math.max(0, col)),
    row: Math.min(rows - 1, Math.max(0, row)),
  };
}
