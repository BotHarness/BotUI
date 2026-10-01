/**
 * The `order` examples on the page.
 *
 * These are the only place the `order` seam is visible to a visitor, so the failure this
 * guards against is not a wrong number — it is a demo that renders nothing, or renders the
 * PRESET's motion while claiming to render something else, which is precisely the failure
 * that made `order` worth having in the first place.
 */
import { describe, expect, it } from "vitest";
import { field, type OrderFn } from "@botharness/botui-core";
import { chevron, nearestCell, ringsFrom } from "../src/traversals.js";

/** the leading cell of a rendered field — the one whose traversal value is lowest */
const lead = (order: OrderFn, cols = 9, rows = 9) => {
  const f = field({ cols, rows, silhouette: "square", renderer: "svg", order }, 0);
  const t = f.reduce((a, b) => (b.order < a.order ? b : a));
  return { col: t.col, row: t.row, order: t.order };
};

describe("the chevron example", () => {
  it("leads from the spine, which is what makes it a chevron", () => {
    const { row } = lead(chevron);
    expect(row, "the fold, not a corner or a sweep").toBe(4);
  });

  it("accelerates — the claim the prose makes, checked against the numbers", () => {
    const f = field({ cols: 9, rows: 9, silhouette: "square", renderer: "svg", order: chevron }, 0);
    const at = (col: number, row: number) => f.find((d) => d.col === col && d.row === row)!.order;
    const steps = [0, 1, 2, 3].map((c) => at(c, 4) - (c > 0 ? at(c - 1, 4) : 0));
    for (let i = 1; i < steps.length; i++) {
      expect(steps[i]!, `step ${i} should exceed step ${i - 1}`).toBeGreaterThan(steps[i - 1]!);
    }
  });

  it("survives a 1-row field, which a pasted traversal divides by zero on", () => {
    const f = field({ cols: 5, rows: 1, silhouette: "square", renderer: "svg", order: chevron }, 0);
    expect(f).toHaveLength(5);
    expect(f.every((d) => Number.isFinite(d.order))).toBe(true);
  });
});

describe("the rings example", () => {
  it("expands from the chosen cell, not from the middle", () => {
    expect(lead(ringsFrom({ col: 4, row: 4 })).order, "the origin leads").toBe(0);
    const corner = lead(ringsFrom({ col: 0, row: 0 }));
    expect(corner.col, "move the origin and the light moves with it").toBe(0);
    expect(corner.row).toBe(0);
  });

  it("is a ring, not a wave — Chebyshev gives every dot on a ring one phase", () => {
    const f = field(
      {
        cols: 9,
        rows: 9,
        silhouette: "square",
        renderer: "svg",
        order: ringsFrom({ col: 4, row: 4 }),
      },
      0,
    );
    // the diagonals: a Euclidean radius would give each of these its own value, a Chebyshev
    // one gives them all the SAME value as their ring
    const at = (col: number, row: number) => f.find((d) => d.col === col && d.row === row)!.order;
    expect(at(4, 1), "(4,1) and (1,4) are on the same Chebyshev ring").toBe(at(1, 4));
    expect(at(4, 2)).toBe(at(2, 4));
    // 0 leads and 1 trails, so a FARTHER ring is a LARGER value
    expect(at(4, 1), "ring 3 outranks ring 2").toBeGreaterThan(at(4, 2));
    expect(at(4, 2), "ring 2 outranks ring 1").toBeGreaterThan(at(4, 3));
  });

  it("reaches 1 at the far corner for EVERY origin, not just the middle one", () => {
    // The bug this catches: normalising by a fixed denominator, or by the distance to the
    // nearest edge, leaves the last ring short of 1 whenever the origin is off-centre — so
    // the wave never quite arrives, and by an amount that depends on where you clicked.
    for (const origin of [
      { col: 0, row: 0 },
      { col: 8, row: 0 },
      { col: 0, row: 8 },
      { col: 4, row: 4 },
      { col: 2, row: 6 },
    ]) {
      const f = field(
        {
          cols: 9,
          rows: 9,
          silhouette: "square",
          renderer: "svg",
          order: ringsFrom(origin),
        },
        0,
      );
      expect(Math.max(...f.map((d) => d.order)), `origin ${origin.col},${origin.row}`).toBe(1);
    }
  });

  it("normalises so the outermost dot leads at 1 whatever the grid", () => {
    // otherwise a 9×9 and a 3×3 would animate at different rates for the same nominal shape
    for (const n of [3, 5, 9, 16]) {
      const f = field(
        {
          cols: n,
          rows: n,
          silhouette: "square",
          renderer: "svg",
          order: ringsFrom({ col: Math.floor(n / 2), row: Math.floor(n / 2) }),
        },
        0,
      );
      const far = Math.max(...f.map((d) => d.order));
      expect(far, `${n}×${n}`).toBeCloseTo(1, 6);
    }
  });

  it("does not divide by zero when the origin is the only cell", () => {
    const f = field(
      {
        cols: 1,
        rows: 1,
        silhouette: "square",
        renderer: "svg",
        order: ringsFrom({ col: 0, row: 0 }),
      },
      0,
    );
    expect(f[0]!.order).toBe(0);
  });
});

describe("the code shown beside the field", () => {
  it("starts at the first export, not at the file's opening comment", async () => {
    // A visitor's first question is what to copy. Five paragraphs of rationale about why
    // these examples exist is for us, and scrolling past it to reach the function is the
    // wrong first impression of a code sample.
    const raw = (await import("../src/traversals.ts?raw")).default as string;
    const shown = raw.slice(raw.indexOf("export"));
    expect(shown.startsWith("export"), "and it is a real slice of this file").toBe(true);
    expect(shown).toContain("export const chevron");
    expect(shown).toContain("export function ringsFrom");
    // the header comment is where it starts, so slicing must exclude it
    expect(shown, "the file header is not shown").not.toContain(
      "Two traversals the library does not ship",
    );
    // and nothing was lost that a copy needs: the type import is the one thing that is
    expect(shown).not.toContain("import type");
  });

  it("cannot drift from the code that runs, because it IS that code", async () => {
    // The whole reason for `?raw` rather than a hand-maintained string: a copied snippet of
    // a function is a snippet that lies the first time someone edits the function.
    const raw = (await import("../src/traversals.ts?raw")).default as string;
    expect(raw, "the raw import is the file's own text").toContain("const arm = Math.abs");
    expect(raw).toContain("return v * v;");
  });
});

describe("picking the origin by clicking", () => {
  it("maps a click near the centre to the centre cell", () => {
    const pitch = 260 / 9;
    expect(nearestCell({ x: 0, y: 0 }, { x: pitch, y: pitch }, 9, 9)).toEqual({ col: 4, row: 4 });
  });

  it("maps the top-left corner to cell 0,0", () => {
    const pitch = 260 / 9;
    const half = 260 / 2;
    expect(nearestCell({ x: -half, y: -half }, { x: pitch, y: pitch }, 9, 9)).toEqual({
      col: 0,
      row: 0,
    });
  });

  it("clamps a click past the edge rather than indexing out of the lattice", () => {
    // The dot marker is drawn INSIDE the field box, so a click near the border can land a
    // little beyond the last cell. An unclamped index would select nothing and the demo
    // would silently stop responding at exactly the edge a visitor aims for.
    const pitch = 260 / 9;
    const far = { x: 9999, y: 9999 };
    expect(nearestCell(far, { x: pitch, y: pitch }, 9, 9)).toEqual({ col: 8, row: 8 });
  });
});
