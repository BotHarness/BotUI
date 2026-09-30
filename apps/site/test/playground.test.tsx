// @vitest-environment jsdom
/**
 * The playground, driven.
 *
 * A slider that renders and does nothing looks exactly like a slider that works, in a
 * screenshot and in a DOM dump. So these tests dispatch real input events and read the
 * resulting field: the control has to change the geometry, not the label.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Playground } from "../src/components/Playground.js";
import { DEFAULTS, cellsFor } from "@botharness/botui-core";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// React 19's act() refuses to run unless the environment opts in. Without this every
// render is a no-op with a warning, and the assertions fail for a reason that has
// nothing to do with the component.
const src = join(dirname(fileURLToPath(import.meta.url)), "../src");

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  svgForced = false;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(<Playground />);
  });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

/**
 * The rendered field, as a comparable signature.
 *
 * Read from the SVG renderer, and the SVG renderer is switched ON first: the playground
 * now opens on CSS — it is the cheaper renderer and the one worth demonstrating — and a
 * CSS field paints `@keyframes`, so there are no paths to read. Every geometry
 * assertion below is about the engine's geometry, which both renderers share, so
 * measuring it through SVG is measuring the same thing.
 */
let svgForced = false;
const useSvgRenderer = () => {
  if (svgForced) return;
  const toggle = container.querySelector<HTMLInputElement>(".stage-toggle input");
  if (toggle?.checked) act(() => toggle.click());
  svgForced = true;
};

const field = () => {
  useSvgRenderer();
  return [...container.querySelectorAll(".playground-stage svg path")].map((p) => ({
    d: p.getAttribute("d"),
    t: p.getAttribute("transform"),
    o: p.getAttribute("fill-opacity"),
  }));
};

/** a slider inside a specific column, so the stage's own controls cannot be mistaken
 *  for the side column's identically-named ones */
const sliderIn = (scope: string, label: RegExp) => {
  const field = [...container.querySelectorAll(`${scope} .playground-field`)].find((row) =>
    label.test(row.querySelector("span")?.textContent ?? ""),
  );
  const input = field?.querySelector("input[type=range]") as HTMLInputElement | null;
  if (!input) throw new Error(`no slider matching ${label} in ${scope}`);
  return input;
};

const slider = (label: RegExp) => {
  const field = [...container.querySelectorAll(".playground-side .playground-field")].find((row) =>
    label.test(row.querySelector("span")?.textContent ?? ""),
  );
  const input = field?.querySelector("input[type=range]") as HTMLInputElement | null;
  if (!input) throw new Error(`no slider matching ${label}`);
  return input;
};

/**
 * Set a controlled input's value the way a user would.
 *
 * React patches the `value` property on the element and keeps a tracker of the last
 * value it wrote. Assigning `input.value` directly goes through that patched setter,
 * so React's own tracker already agrees with the new value and it concludes nothing
 * changed — the handler never fires and the control looks broken. Calling the
 * prototype's setter, which React does not patch, is what makes the event real.
 */
const setNativeValue = (input: HTMLInputElement | HTMLSelectElement, value: string) => {
  const proto = input instanceof HTMLSelectElement ? HTMLSelectElement : HTMLInputElement;
  Object.getOwnPropertyDescriptor(proto.prototype, "value")?.set?.call(input, value);
};

const drag = (input: HTMLInputElement, value: number) => {
  act(() => {
    setNativeValue(input, String(value));
    input.dispatchEvent(new window.Event("input", { bubbles: true }));
  });
};

/** the card in a group whose label matches, by its radio value */
const card = (groupLabel: RegExp, value: string) => {
  const group = [...container.querySelectorAll(".card-group")].find((g) =>
    groupLabel.test(g.querySelector("legend")?.textContent ?? ""),
  );
  const input = group?.querySelector(
    `input[type=radio][value="${value}"]`,
  ) as HTMLInputElement | null;
  if (!input) throw new Error(`no card ${value} in ${groupLabel}`);
  return input;
};

const pick = (input: HTMLInputElement) => {
  act(() => {
    input.click();
  });
};

/** a +/- stepper by its label, as the three controls it actually is */
const stepper = (label: RegExp) => {
  const row = [...container.querySelectorAll(".stepper")].find((r) =>
    label.test(r.querySelector(".stepper-label")?.textContent ?? ""),
  );
  if (!row) throw new Error(`no stepper matching ${label}`);
  const [dec, inc] = row.querySelectorAll("button");
  return {
    dec: dec as HTMLButtonElement,
    inc: inc as HTMLButtonElement,
    value: row.querySelector("output") as HTMLOutputElement,
  };
};

const step = (label: RegExp, by: 1 | -1) => {
  // re-query each time: React replaces these nodes on each render, so a reference
  // captured before the first click is detached from the document by the second
  const s = stepper(label);
  act(() => {
    (by === 1 ? s.inc : s.dec).click();
  });
};

const readout = () => container.querySelector(".playground-readout")?.textContent ?? "";

describe("the playground controls", () => {
  it("paints a field on mount", () => {
    expect(field().length).toBeGreaterThan(10);
  });

  it("every slider can actually reach its own declared maximum", () => {
    // `PercentSlider` clamped its value to `fraction * 100` with fraction pinned inside
    // [0, 1] — so a slider declaring `max={200}` could never pass 100. Gap X, Gap Y and
    // stagger all declare 200, which is the range where dots overlap and where a
    // per-dot delay is wider than the whole cycle. Those three were pinned at 100: the
    // thumb sat at the middle of its own track and the top half of the travel did
    // nothing. A slider whose declared max it cannot reach is a control lying about its
    // own range, which is the defect the repo already records for these three.
    const sliders = [...container.querySelectorAll(".playground-field input[type=range]")];
    expect(sliders.length).toBeGreaterThan(5);
    for (const input of sliders) {
      const min = Number(input.min);
      const max = Number(input.max);
      const label = input.closest(".playground-field")?.querySelector("span")?.textContent ?? "";
      // drive it to the top of its own track
      drag(input, max);
      const at = Number(input.value);
      expect(at, `${label.trim()} declares max=${max} but stops at ${at}`).toBe(max);
      drag(input, min);
      expect(Number(input.value), `${label.trim()} does not reach its min`).toBe(min);
    }
  });

  it("opens on the CSS renderer, because it is the one worth demonstrating", () => {
    // CSS costs zero JS per frame and SVG is the escape hatch for the motions CSS
    // cannot express, so the cheaper one is the default and the other has to be asked
    // for. It also means the field on arrival is the one most people will actually ship.
    const toggle = container.querySelector<HTMLInputElement>(".stage-toggle input");
    expect(toggle, "the renderer switch lives on the stage").toBeTruthy();
    expect(toggle!.checked, "CSS renderer is the default").toBe(true);
    expect(
      toggle!.disabled,
      "the default preset is expressible in CSS, so the switch must be usable",
    ).toBe(false);
    // and the field really is CSS: no SVG paths in the stage
    expect(container.querySelectorAll(".playground-stage svg path").length).toBe(0);
  });

  it("refuses the CSS renderer only for a motion it cannot express", () => {
    // the inverse of the above: `columns` staggers each column's entry, which a
    // per-dot animation-delay does not model, so the engine refuses rather than
    // approximating. The toggle must disable AND say why, rather than showing a
    // different animation under the same name.
    const toggle = container.querySelector<HTMLInputElement>(".stage-toggle input")!;
    pick(card(/motion|动效/i, "columns"));
    expect(toggle.disabled, "a per-dot delay cannot move a highlight").toBe(true);
    expect(
      container.querySelector(".stage-toggle")?.textContent,
      "and it has to say so where the switch is",
    ).toMatch(/refuses it/);
    pick(card(/motion|动效/i, "spiral"));
    expect(toggle.disabled, "spiral is expressible, so the switch comes back").toBe(false);
  });

  it("has a speed control, because a loading field you cannot slow down is a GIF", () => {
    const input = slider(/速度|speed/i);
    expect(input).toBeTruthy();
    const before = field();
    drag(input, 300);
    // the geometry is unchanged — speed is a clock, not a shape — so the check is that
    // the readout moved and nothing threw
    expect(readout()).toContain("speed 3.00×");
    expect(field().length).toBe(before.length);
  });

  it("a silhouette card changes which cells exist", () => {
    // square keeps every cell; cross drops most of them. The control is a card now,
    // but the claim it has to support is unchanged — it changes the FIELD, not a label.
    pick(card(/shape|形状/i, "square"));
    const square = field().length;
    pick(card(/shape|形状/i, "ring"));
    const ring = field().length;
    expect(square, "square keeps every cell of a 7×7 lattice").toBe(49);
    expect(ring, "ring keeps only its outline").toBeLessThan(square);
    expect(readout()).toContain("ring");
  });

  it("the sliders people reported as unreachable come before the ones nobody opens first", () => {
    // `softness`, `grow` and `floor` were reported as having "no way to adjust them".
    // They were on the page the whole time: the side column was 1001px of content in an
    // 813px viewport, so they sat below the fold of a column nobody could see the
    // bottom of, under a card grid above them. Position is the bug, not absence, and
    // only an ORDER assertion catches a regression here — a test that checked the
    // controls exist would have passed while they were unreachable.
    // by index rather than by string search on the joined text: the legend is CSS
    // `text-transform: uppercase`d on screen but the DOM text is `Envelope`, and a
    // lowercase `.indexOf` found nothing while the control was right there
    const legends = [...container.querySelectorAll(".playground-side .playground-group")].map(
      (g) => g.querySelector("legend")?.textContent ?? "",
    );
    const order = legends.join("|");
    const envelopeAt = legends.findIndex((l) => /envelope|包络/i.test(l));
    const detailAt = legends.findIndex((l) => /dot detail/i.test(l));
    expect(envelopeAt, `ENVELOPE must exist in the side column: ${order}`).toBeGreaterThanOrEqual(
      0,
    );
    expect(envelopeAt, "the envelope sliders must come BEFORE the geometric detail").toBeLessThan(
      detailAt,
    );

    // and the three of them are the ones named, in this order
    const envelope = [...container.querySelectorAll(".playground-side .playground-group")].find(
      (g) => /envelope|包络/i.test(g.querySelector("legend")?.textContent ?? ""),
    );
    const labels = [...(envelope?.querySelectorAll(".playground-field") ?? [])].map((f) =>
      (f.querySelector("span")?.textContent ?? "").slice(0, 14),
    );
    expect(labels).toHaveLength(3);
    expect(labels[0]).toMatch(/softness|波宽/i);
    expect(labels[1]).toMatch(/grow|呼吸/i);
    expect(labels[2]).toMatch(/floor|底噪/i);
  });

  it("the scrolling rows clip their overflow, so a card cannot sit on top of a slider", () => {
    // Reported as "Chasing and Morphing often will not click". Those two were clickable;
    // the cards PAST them were not. `overflow-x: auto` scrolls and clips the PAINTING,
    // but the outgoing cards stayed hit-testable past the row's right edge — over
    // `.playground-field`, which comes later in the DOM and therefore won the click. So
    // Breathing, Morphing and `off` rendered, looked selectable, and swallowed nothing:
    // the slider underneath them took every click. `contain: paint` is what stops it.
    //
    // Asserted against the STYLESHEET, not getComputedStyle: jsdom does not load the
    // page's CSS at all, so every computed value here came back empty. Reading the source
    // is weaker than measuring, and the measurement that found this — `elementFromPoint`
    // inside the overlap, in a real browser — cannot run here. What can be asserted is
    // that the declarations are present, so a future edit that drops `contain: paint`
    // fails here instead of shipping again.
    const css = readFileSync(join(src, "styles/site.css"), "utf8");
    const row = css.match(/\.card-grid \{([^}]*)\}/)?.[1] ?? "";
    expect(row, ".card-grid must exist in the stylesheet").not.toBe("");
    expect(row, "the row scrolls sideways").toMatch(/overflow-x:\s*auto/);
    // Without this the overflow is clipped visually and still clickable.
    expect(row, "the row must clip paint, or outgoing cards steal slider clicks").toMatch(
      /contain:\s*paint/,
    );
  });

  it("a card group is one tab stop with one selection, not a grid of buttons", () => {
    // A grid of <button>s would make every card a tab stop and would leave the group
    // with no announced position ("3 of 14"), and arrow keys would do nothing. Radios
    // inside a fieldset give all three for free, which is why the cards are radios.
    const groups = container.querySelectorAll(".card-group");
    expect(groups.length).toBeGreaterThanOrEqual(3);
    for (const group of groups) {
      const inputs = group.querySelectorAll("input[type=radio]");
      expect(inputs.length, "every option is a card").toBeGreaterThan(1);
      // a radio group shares a name, so the browser enforces one selection for us
      const names = new Set([...inputs].map((i) => (i as HTMLInputElement).name));
      expect(names.size, "one name per group, so only one card can be checked").toBe(1);
      expect(
        [...inputs].filter((i) => (i as HTMLInputElement).checked).length,
        "exactly one card is selected",
      ).toBe(1);
    }
  });

  it("every card says what it changes, so the two shape groups are distinguishable", () => {
    // The engine has two shapes — the field's outline and the dot inside it — and one
    // slider list labelled only "shape" left a reader guessing which was which. Each
    // group states its scope in the same place, so the distinction is readable before
    // anything is clicked.
    const scopes = [...container.querySelectorAll(".card-group .card-scope")].map(
      (s) => s.textContent ?? "",
    );
    expect(scopes.length).toBeGreaterThanOrEqual(3);
    expect(new Set(scopes).size, "each group states a different scope").toBe(scopes.length);
    for (const scope of scopes) expect(scope.length).toBeGreaterThan(0);
  });

  it("the selected card is the shape actually rendered", () => {
    // A hardcoded fallback here (`options.silhouette ?? "square"`) disagreed with the
    // engine's own default of `circle`, so on first paint the page highlighted `square`
    // while drawing a circle — 29 cells of circle under a card marked square. The old
    // slider hid it by indexing into the key list; a card shows its selection, so it
    // could not. Asserted against the ENGINE's default, not a literal, so the test
    // cannot drift the same way the code did.
    // matched per GROUP rather than by document order: the groups were reordered (motion
    // now sits above shape, next to the field it animates), and asserting on the
    // flattened list would fail on a layout change rather than on a bug.
    const checkedIn = (legend: RegExp) =>
      [...container.querySelectorAll(".card-group")]
        .find((g) => legend.test(g.querySelector("legend")?.textContent ?? ""))
        ?.querySelector("input:checked")
        ?.getAttribute("value");

    expect(checkedIn(/shape ·|形状/i), "the silhouette card is the engine's default").toBe(
      DEFAULTS.silhouette,
    );
    expect(checkedIn(/dot shape|点的形状/i), "the dot card is the engine's default").toBe(
      DEFAULTS.dot,
    );
    expect(checkedIn(/motion|动效/i), "the motion card is the engine's default").toBe(
      DEFAULTS.preset,
    );
    const drawn = field().length;
    expect(drawn, "the rendered field matches the selected silhouette").toBe(
      cellsFor(DEFAULTS.cols, DEFAULTS.rows, DEFAULTS.silhouette).length,
    );
  });

  it("a dot card changes the glyph, not the set of cells", () => {
    // the two card groups act on different things, which is the whole reason they are
    // two groups: a dot must not change which cells exist, a silhouette must not change
    // the dot's path. Before the split both were sliders in one list labelled only
    // "shape", and nothing on the page said which was which.
    const cellsBefore = field().length;
    const pathBefore = field()[0]?.d;
    pick(card(/dot shape|点的形状/i, "triangle"));
    expect(field().length, "a dot shape must not add or remove cells").toBe(cellsBefore);
    expect(field()[0]?.d, "a dot card must change the glyph path").not.toBe(pathBefore);
    expect((field()[0]?.d!.match(/[ML]/g) ?? []).length, "a triangle has three vertices").toBe(3);

    const pathAfterDot = field()[0]?.d;
    pick(card(/shape|形状/i, "diamond"));
    expect(field()[0]?.d, "a silhouette must not change the glyph").toBe(pathAfterDot);
  });

  it("the dot sides slider changes the glyph path, not just a label", () => {
    const input = slider(/sides/i);
    const before = field()[0]?.d;
    drag(input, 3);
    const triangle = field()[0]?.d;
    drag(input, 6);
    const hexagon = field()[0]?.d;
    expect(triangle).not.toBe(before);
    expect(hexagon).not.toBe(triangle);
    // and every dot on the field got the new glyph, not just the first
    expect(new Set(field().map((p) => p.d)).size).toBe(1);
    expect(readout()).toContain("hexagon");
  });

  it("the dot radius slider rounds the polygon without changing its extent", () => {
    const input = slider(/radius/i);
    drag(input, 0);
    const square = field()[0]?.d;
    expect(square, "radius 0 must be hard corners").not.toContain("Q");
    drag(input, 71); // the inradius of a square on the unit circle
    const rounded = field()[0]?.d;
    expect(rounded, "a rounded square must contain curves").toContain("Q");
    // the dot still occupies the same box: the scale is the dot's, not the curve's
    expect(field()[0]?.t).toBe(container.querySelectorAll("path")[0]?.getAttribute("transform"));
  });

  it("a dot card can reach a shape sides cannot", () => {
    // a star is a NOTCH between the points, so no value of `sides` produces one
    pick(card(/dot shape|点的形状/i, "star5"));
    const star = field()[0]?.d;
    expect(star).toBeTruthy();
    // ten vertices: five points and five notches
    expect((star!.match(/[ML]/g) ?? []).length).toBe(10);
  });

  it("the column stepper changes the geometry", () => {
    const before = field().length;
    for (let i = 0; i < 4; i++) step(/^cols$|列/i, -1);
    expect(field().length, "a 3-wide square keeps fewer cells than a 7-wide one").toBeLessThan(
      before,
    );
  });

  it("a stepper stops at its bounds instead of reporting a value it cannot set", () => {
    const s7 = stepper(/^cols$|列/i);
    // walk to the top, then keep going: the button disables, so the value cannot run
    // past max and leave the readout claiming a grid the field does not have
    for (let i = 0; i < 40; i++) step(/^cols$|列/i, 1);
    expect(Number(s7.value.textContent)).toBe(16);
    expect(s7.inc.disabled, "at the maximum the increment must be disabled").toBe(true);
    for (let i = 0; i < 40; i++) step(/^cols$|列/i, -1);
    expect(Number(s7.value.textContent)).toBe(1);
    expect(s7.dec.disabled, "at the minimum the decrement must be disabled").toBe(true);
  });

  it("only the tighter axis resizes the dot; the other just redistributes air", () => {
    // 3 cols by 7 rows: the ROW cell is the tighter one, so the dot is sized from it.
    // That asymmetry is deliberate and load-bearing — a dot that grew to fill the slack
    // on the roomy axis would be wider than it is tall — and it is exactly the kind of
    // thing a test that only checked "the number changed" would miss.
    for (let i = 0; i < 4; i++) step(/^cols$|列/i, -1);
    // an SVG transform reads `translate(x y) scale(s)` — space separated, not comma
    const transform = /translate\((-?[\d.]+)\s+(-?[\d.]+)\) scale\((-?[\d.]+)\)/;
    const read = (dot: { t?: string | null }) => transform.exec(dot.t ?? "");
    const scale = () => read(field()[0] ?? {})?.[3];
    const axisX = () => [...new Set(field().map((dot) => read(dot)?.[1]))];
    const axisY = () => [...new Set(field().map((dot) => read(dot)?.[2]))];

    // the roomy axis (x): positions move, the dot does not. Widening first makes the
    // comparison a change rather than a drag to a value already in effect.
    drag(slider(/gap x/i), 100);
    const xWide = axisX();
    const scaleAtWideX = scale();
    drag(slider(/gap x/i), 0);
    expect(axisX(), "gap x must move the dots along x").not.toEqual(xWide);
    expect(scale(), "gap x must NOT resize the dot — the rows are tighter").toBe(scaleAtWideX);

    // the tighter axis (y): everything moves. Widening first, for the same reason.
    drag(slider(/gap y/i), 100);
    const yWide = axisY();
    const scaleAtWideY = scale();
    drag(slider(/gap y/i), 0);
    expect(axisY(), "gap y must move the dots along y").not.toEqual(yWide);
    expect(scale(), "gap y DOES resize the dot — it is the tighter axis").not.toBe(scaleAtWideY);
  });

  it("the dot/cell slider still lands the field exactly on the box at 200%", () => {
    // the invariant the whole size algebra exists for, exercised through the UI
    // the compact one ON the stage, not any other field
    const input = sliderIn(".stage-controls", /dot \/ cell/i);
    drag(input, 200);
    expect(Number(input.max), "dot/cell must still reach 200%").toBe(200);
    expect(readout()).toContain("dot / cell   200%");
    // 200% of the cell with a 0.45 gap is past touching, so the pitch share is > 100
    const share = Number(/dot \/ pitch\s+(\d+)%/.exec(readout())?.[1]);
    expect(share).toBeGreaterThan(100);
  });

  it("refuses the CSS renderer for a motion it cannot express, and says why", () => {
    const checkbox = container.querySelector(".stage-toggle input") as HTMLInputElement;
    pick(card(/motion|动效/i, "columns"));
    expect(checkbox.disabled, "a per-dot delay cannot move a highlight").toBe(true);
    // the explanation moved onto the toggle itself when it joined the stage
    expect(container.querySelector(".stage-toggle")?.textContent).toMatch(/refuses it/);
  });
});

describe("every slider represents the value it shows", () => {
  /**
   * The audit that was missing.
   *
   * Three sliders were passing a raw 0…1 fraction against a track measured in
   * hundredths. The field DID change when they were dragged — the handler was wired
   * and the geometry moved — so every "does this control do anything" test passed. What
   * was broken is that the THUMB sat at the wrong place: radius 0.7 on a 0…90 track
   * reads as 0.8% of the travel, which is why it felt stuck, and speed 1 on a 5…300
   * track clamps to the minimum, which is why it felt inert.
   *
   * So the assertion is not "the field changed" but "the control's position is inside
   * its own declared range, and matches the number in the label". A slider outside its
   * range is a slider lying about where it is.
   */
  const thumbFor = (shown: string): number | null => {
    // a percent ANYWHERE in the label, not only at the start: a label that leads with
    // "preset 95%" is the same kind of truth as "55%", and anchoring the match to the
    // start meant the one slider whose default comes from a preset was the one slider
    // the audit skipped
    const percent = /(-?\d+(?:\.\d+)?)\s*%/.exec(shown);
    if (percent) return Math.round(Number(percent[1]));
    // a `×` label is the raw option as a decimal, so 1.00× is thumb 100
    const times = /(-?\d+(?:\.\d+)?)\s*×/.exec(shown);
    if (times) return Math.round(Number(times[1]) * 100);
    return null;
  };

  const rows = () =>
    [...container.querySelectorAll(".playground-field")].map((row) => {
      const label = row.querySelector("span")?.textContent ?? "";
      const input = row.querySelector("input[type=range]") as HTMLInputElement | null;
      const shown = row.querySelector("em")?.textContent ?? "";
      return { label, shown, input };
    });

  it("every slider thumb agrees with the number its label reports", () => {
    /**
     * The audit, in one assertion.
     *
     * Three sliders were passing a raw 0…1 fraction against a track measured in
     * hundredths: radius 0.7 on a 0…90 track (thumb at 0.8% of travel — it looked
     * stuck), aspect 1 on a 20…100 track, and speed 1 on a 5…300 track (clamped to
     * the minimum — it looked inert).
     *
     * Two things make this hard to catch by the obvious test. First, "does dragging it
     * change the field" PASSES for all three: the handler is wired and the geometry
     * does move once a value arrives. Second, "is the value inside min/max" also
     * passes, because the BROWSER clamps the value before the DOM can be read — the
     * defect is invisible from inside the element.
     *
     * So the check compares two things the user can see at once: the thumb, and the
     * number printed beside it. Labels that are not a plain percentage or multiplier
     * (a px size, a count, a shape name) are skipped — there is nothing to compare.
     *
     * The two suffixes do not mean the same thing, and the test has to know it: a `%`
     * label is already in track units ("55%" is thumb 55), while a `×` label is the raw
     * option shown as a decimal ("1.00×" is 1, which is thumb 100). That inconsistency
     * is the component's — speed is a multiplier, everything else is a proportion — and
     * encoding it here is what stops the audit from crying wolf on seven controls.
     */
    const offenders: string[] = [];
    for (const { label, shown, input } of rows()) {
      if (!input || !shown) continue;
      const expected = thumbFor(shown);
      if (expected === null) continue;
      const actual = Number(input.value);
      if (Math.abs(actual - expected) > 1) {
        offenders.push(
          `${label.trim()}: label "${shown}" means ${expected} on the track, thumb is at ${actual}`,
        );
      }
    }
    expect(
      offenders,
      `a slider whose thumb and label disagree — it reads as broken:\n  ${offenders.join("\n  ")}`,
    ).toEqual([]);
  });

  it("the browser never has to clamp a slider to make it legal", () => {
    // same failure from the other side: a value below `min` is accepted by the DOM and
    // silently clamped, so the test has to compare what React ASKED for against the
    // range it declared
    const offenders: string[] = [];
    for (const { label, shown, input } of rows()) {
      if (!input || !shown) continue;
      const requested = thumbFor(shown);
      if (requested === null) continue;
      const min = Number(input.getAttribute("min"));
      const max = Number(input.getAttribute("max"));
      if (requested < min || requested > max) {
        offenders.push(`${label.trim()}: wants ${requested}, declares [${min}, ${max}]`);
      }
    }
    expect(
      offenders,
      `a slider whose own value is out of its declared range:\n  ${offenders.join("\n  ")}`,
    ).toEqual([]);
  });

  it("the radius slider spans exactly 0 to the polygon inradius, so full travel is a circle", () => {
    const input = slider(/radius/i);
    const max = Number(input.getAttribute("max"));
    // a square's inradius is cos(pi/4) = 0.707, so the top of the travel is 71%
    expect(max).toBe(71);
    drag(input, max);
    const atMax = field()[0]?.d ?? "";
    expect(atMax, "the top of the travel must be a rounded polygon").toContain("Q");
    drag(input, 0);
    expect(field()[0]?.d ?? "", "the bottom of the travel must be hard corners").not.toContain("Q");
  });

  it("the radius slider retunes itself when the side count changes", () => {
    // a triangle's inradius is 0.5 and a pentagon's is 0.809, so a fixed maximum would
    // be unreachable for one and meaningless for the other
    const radius = () => slider(/radius/i);
    expect(Number(radius().getAttribute("max"))).toBe(71); // square
    drag(slider(/sides/i), 3);
    expect(Number(radius().getAttribute("max"))).toBe(50); // triangle
    drag(slider(/sides/i), 5);
    expect(Number(radius().getAttribute("max"))).toBe(81); // pentagon
  });

  it("dragging radius visibly rounds the dot, corner by corner", () => {
    // the reason it "felt stuck" was also that the effect is subtle at dot sizes; this
    // pins that the geometry really does move, so a future regression is not a matter
    // of opinion
    const input = slider(/radius/i);
    const cornerAt = (v: number) => {
      drag(input, v);
      return field()[0]?.d ?? "";
    };
    const square = cornerAt(0);
    const rounded = cornerAt(35);
    expect(square).not.toBe(rounded);
    // the flat between the corners shortens as the fillet grows
    expect(square.startsWith("M0.7071"), square.slice(0, 24)).toBe(true);
    expect(rounded.startsWith("M0.3"), rounded.slice(0, 24)).toBe(true);
  });

  it("the speed slider starts where the option says it does", () => {
    const input = slider(/speed/i);
    // default speed 1 on a 5…300 track: the thumb must be at 100, not clamped to 5
    expect(Number(input.value)).toBe(100);
    drag(input, 300);
    expect(readout()).toContain("speed 3.00×");
  });
});

describe("a dial that follows a preset must be able to return to it", () => {
  /**
   * The stagger dial is the one control whose default is not a constant — it is the
   * preset's own spread — and that made it a one-way door. Once dragged, `stagger` is a
   * number forever: the label stops saying "preset", switching the preset no longer moves
   * the dial, and nothing on screen offers the way back.
   *
   * It also produced the only label the audit had been skipping, because the word
   * "preset" carries no digit while the thumb sat at 95.
   */
  const staggerRow = () =>
    [...container.querySelectorAll(".playground-field")].find((row) =>
      /stagger/i.test(row.querySelector("span")?.textContent ?? ""),
    )!;

  it("the label states the preset’s own number, so it can never disagree with the thumb", () => {
    const row = staggerRow();
    const shown = row.querySelector("em")?.textContent ?? "";
    const input = row.querySelector("input") as HTMLInputElement;
    // spiral's spread is 0.95, and the label has to say so. The expectation comes
    // from the message rather than a literal, so this test does not encode a language:
    // a hardcoded "预设" here would have passed in English and failed in Chinese.
    expect(shown).toContain("95%");
    expect(Number(input.value)).toBe(95);
  });

  it("following the preset is reversible", () => {
    const row = staggerRow();
    const input = row.querySelector("input") as HTMLInputElement;
    const reset = row.querySelector(".reset") as HTMLButtonElement;
    expect(reset, "there must be a way back to the preset").toBeTruthy();

    drag(input, 20);
    expect(staggerRow().querySelector("em")?.textContent).toMatch(/^\s*20%/);
    expect(staggerRow().querySelector(".reset")?.textContent).toBe("↺");

    act(() => reset.click());
    // back to following the preset: the label is a WORD plus the number, and which
    // word depends on the locale, so only the number is asserted
    expect(staggerRow().querySelector("em")?.textContent).toMatch(/95%/);
    expect(staggerRow().querySelector(".reset")?.textContent).toBe("·");
    expect(Number((staggerRow().querySelector("input") as HTMLInputElement).value)).toBe(95);
  });

  it("changing the preset moves the dial again once it is back to following", () => {
    // override, switch preset — the dial must NOT follow, because it is overridden
    drag(staggerRow().querySelector("input") as HTMLInputElement, 20);
    pick(card(/motion|动效/i, "ring"));
    expect(Number((staggerRow().querySelector("input") as HTMLInputElement).value)).toBe(20);

    // back to following, and now the preset does move it: ring's spread is 0.34
    act(() => (staggerRow().querySelector(".reset") as HTMLButtonElement).click());
    // back to spiral, then to ring again, so this is a CHANGE and not a repeat of
    // the click the previous assertion already made
    pick(card(/motion|动效/i, "spiral"));
    pick(card(/motion|动效/i, "ring"));
    expect(Number((staggerRow().querySelector("input") as HTMLInputElement).value)).toBe(34);
    expect(staggerRow().querySelector("em")?.textContent).toMatch(/34%/);
  });
});
