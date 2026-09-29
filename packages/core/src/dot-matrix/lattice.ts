import type { LatticeCell, Silhouette, SilhouetteFn } from "../types.js";

/**
 * Which cells exist. `square` keeps everything; the rest are masks over the same
 * lattice, defined on normalised coordinates so a shape reads the same at any
 * cols/rows.
 */
export const SILHOUETTES: Record<Silhouette, SilhouetteFn> = {
  square: () => true,
  circle: (nx, ny) => nx * nx + ny * ny <= 1,
  diamond: (nx, ny) => (Math.abs(nx) + Math.abs(ny)) / 1.15 <= 1,
  hex: (nx, ny) => {
    const x = Math.abs(nx);
    const y = Math.abs(ny);
    return y <= 0.82 && x * 0.62 + y * 0.78 <= 1;
  },
  ring: (nx, ny) => {
    const d = Math.hypot(nx, ny);
    return d <= 1 && d >= 0.62;
  },
  cross: (nx, ny) => Math.abs(nx) * 0.75 + Math.abs(ny) * 0.75 <= 1,
};

export const SILHOUETTE_KEYS = Object.keys(SILHOUETTES) as Silhouette[];

/**
 * The kept cells of a silhouette, with their normalised coordinates. Every cell
 * of the full lattice is considered in order, so trimming a silhouette never
 * renumbers the motion.
 */
export function cellsFor(cols: number, rows: number, silhouette: Silhouette): LatticeCell[] {
  const keep = SILHOUETTES[silhouette] ?? SILHOUETTES.square;
  const out: LatticeCell[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const nx = cols === 1 ? 0 : (col / (cols - 1)) * 2 - 1;
      const ny = rows === 1 ? 0 : (row / (rows - 1)) * 2 - 1;
      if (keep(nx, ny)) out.push({ col, row, nx, ny });
    }
  }
  return out;
}
