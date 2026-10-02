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
 * A NARROW CHEVRON — one cell wide, and quantised like `ring` is.
 *
 * The first version of this was `arm * 0.6 + along * 0.4`, squared. Its level sets are V
 * shapes in theory and a soft blob in practice, because `arm` takes only five distinct
 * values on a 9-row field and no envelope can resolve a line out of five steps — the demo
 * looked like a glow in one corner. Quantisation is what `ring` already does for exactly
 * this reason, and on an integer lattice it is the only thing that CAN produce a discrete
 * shape.
 *
 * `|along - arm|` is zero ALONG the chevron, so quantising it draws nested outlines of the
 * arrow rather than a wash across it. Each is one cell wide because consecutive cells differ
 * by more than one band; that is the "narrow" in narrow arrow, and it is what makes the
 * shape read as an arrow instead of as a gradient.
 */
export const chevron: OrderFn = (col, row, cols, rows) => {
  const mid = (rows - 1) / 2;
  const arm = Math.abs(row - mid) / (mid || 1);
  const along = col / (cols - 1 || 1);
  // one band per step of the grid: any fewer and adjacent cells share a band and the arrow
  // thickens, any more and there is no cell left to light
  const bands = Math.max(cols, rows);
  return Math.round(Math.abs(along - arm) * bands) / bands;
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

/**
 * The cell a pointer is over, and the pixel position of a cell's centre.
 *
 * Both come from the ENGINE's own `layout()` numbers, and that is the whole point: the
 * handle is drawn where this function says and the hit-test is taken against the same
 * function, so "the handle is under the cursor" is true by construction rather than by two
 * approximations agreeing.
 *
 * Two mistakes are written into the old version and are worth naming, because both produce
 * a handle that drifts further out the further out you drag — which is exactly the symptom
 * that sent this back:
 *
 *   · the pitch was `box.width / cols`, which is not the pitch. The field's box is `size`
 *     px including one dot of overhang, so the centre-to-centre distance is
 *     `layout().pitchX` and the box/n is about 3% out before anything else is wrong;
 *   · and the centre-to-cell conversion multiplied by `(cols - 1) / 2` a second time, making
 *     the whole thing FOUR TIMES as sensitive as it should be. At the edge of a 9-wide field
 *     that is a twelve-cell error, clamped — so the handle sat at the rim while the cursor
 *     was halfway out, and dragging further changed nothing at all.
 *
 * The fixed version is the identity: a dot's centre is `dotPx/2 + col * pitchX` from the
 * field's left edge, and a pointer at offset `x` from the field's centre is
 * `x / pitchX` cells from the middle one.
 */
export interface FieldGeometry {
  /** centre-to-centre distance in px, per axis */
  pitchX: number;
  pitchY: number;
  /** one dot's width in px — the overhang at each end of the box */
  dotPx: number;
}

/** where a cell's centre sits, relative to the field's box */
export function cellCentre(
  geo: FieldGeometry,
  cell: { col: number; row: number },
): { x: number; y: number } {
  return {
    x: geo.dotPx / 2 + cell.col * geo.pitchX,
    y: geo.dotPx / 2 + cell.row * geo.pitchY,
  };
}

/** the cell whose centre is nearest a point given as an offset from the field's centre */
export function nearestCell(
  at: { x: number; y: number },
  geo: FieldGeometry,
  cols: number,
  rows: number,
): { col: number; row: number } {
  const col = Math.round((cols - 1) / 2 + at.x / geo.pitchX);
  const row = Math.round((rows - 1) / 2 + at.y / geo.pitchY);
  return {
    // clamped, because a drag that leaves the field should park the origin at the rim
    // rather than index off the lattice
    col: Math.min(cols - 1, Math.max(0, col)),
    row: Math.min(rows - 1, Math.max(0, row)),
  };
}
