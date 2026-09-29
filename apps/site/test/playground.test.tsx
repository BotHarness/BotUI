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

// React 19's act() refuses to run unless the environment opts in. Without this every
// render is a no-op with a warning, and the assertions fail for a reason that has
// nothing to do with the component.
beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
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

/** the rendered field, as a comparable signature */
const field = () =>
  [...container.querySelectorAll(".playground-stage svg path")].map((p) => ({
    d: p.getAttribute("d"),
    t: p.getAttribute("transform"),
    o: p.getAttribute("fill-opacity"),
  }));

const slider = (label: RegExp) => {
  const field = [...container.querySelectorAll(".playground-field")].find((row) =>
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

const choose = (select: HTMLSelectElement, value: string) => {
  act(() => {
    setNativeValue(select, value);
    select.dispatchEvent(new window.Event("change", { bubbles: true }));
  });
};

const readout = () => container.querySelector(".playground-readout")?.textContent ?? "";

describe("the playground controls", () => {
  it("paints a field on mount", () => {
    expect(field().length).toBeGreaterThan(10);
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

  it("the silhouette slider changes which cells exist", () => {
    const input = slider(/silhouette/i);
    drag(input, 0); // square keeps every cell
    const square = field().length;
    drag(input, 5); // cross drops most of them
    const cross = field().length;
    expect(square).toBe(49);
    expect(cross).toBeLessThan(square);
    expect(readout()).toContain("cross");
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

  it("the dot preset select can reach a shape sides cannot", () => {
    // a star is a NOTCH between the points, so no value of `sides` produces one
    const select = [...container.querySelectorAll(".playground-field")]
      .find((row) => /glyph/i.test(row.querySelector("span")?.textContent ?? ""))
      ?.querySelector("select") as HTMLSelectElement;
    expect(select).toBeTruthy();
    choose(select, "star5");
    const star = field()[0]?.d;
    expect(star).toBeTruthy();
    // ten vertices: five points and five notches
    expect((star!.match(/[ML]/g) ?? []).length).toBe(10);
  });

  it("grid and gap sliders change the geometry", () => {
    const cols = slider(/cols/i);
    const before = field().length;
    drag(cols, 3);
    expect(field().length, "a 3-wide circle keeps fewer cells than a 7-wide one").toBeLessThan(
      before,
    );
  });

  it("only the tighter axis resizes the dot; the other just redistributes air", () => {
    // 3 cols by 7 rows: the ROW cell is the tighter one, so the dot is sized from it.
    // That asymmetry is deliberate and load-bearing — a dot that grew to fill the slack
    // on the roomy axis would be wider than it is tall — and it is exactly the kind of
    // thing a test that only checked "the number changed" would miss.
    drag(slider(/cols/i), 3);
    // an SVG transform reads `translate(x y) scale(s)` — space separated, not comma
    const transform = /translate\((-?[\d.]+)\s+(-?[\d.]+)\) scale\((-?[\d.]+)\)/;
    const read = (dot: { t?: string | null }) => transform.exec(dot.t ?? "");
    const scale = () => read(field()[0] ?? {})?.[3];
    const axisX = () => [...new Set(field().map((dot) => read(dot)?.[1]))];
    const axisY = () => [...new Set(field().map((dot) => read(dot)?.[2]))];

    const baseScale = scale();
    const baseX = axisX();
    const baseY = axisY();

    // the roomy axis: positions move, the dot does not
    drag(slider(/gap x/i), 0);
    expect(axisX(), "gap x must move the dots along x").not.toEqual(baseX);
    expect(scale(), "gap x must NOT resize the dot — the rows are tighter").toBe(baseScale);
    expect(axisY(), "gap x must not move the dots along y").toEqual(baseY);

    // the tighter axis: everything moves
    const scaleBeforeTight = scale();
    const yBeforeTight = axisY();
    drag(slider(/gap y/i), 0);
    expect(axisY(), "gap y must move the dots along y").not.toEqual(yBeforeTight);
    expect(scale(), "gap y DOES resize the dot — it is the tighter axis").not.toBe(
      scaleBeforeTight,
    );
  });

  it("the dot/cell slider still lands the field exactly on the box at 200%", () => {
    // the invariant the whole size algebra exists for, exercised through the UI
    const input = slider(/dot \/ cell/i);
    drag(input, 200);
    expect(readout()).toContain("dot / cell   200%");
    // 200% of the cell with a 0.45 gap is past touching, so the pitch share is > 100
    const share = Number(/dot \/ pitch\s+(\d+)%/.exec(readout())?.[1]);
    expect(share).toBeGreaterThan(100);
  });

  it("refuses the CSS renderer for a motion it cannot express, and says why", () => {
    const preset = [...container.querySelectorAll(".playground-field")]
      .find((row) => /^preset/i.test(row.querySelector("span")?.textContent ?? ""))
      ?.querySelector("select") as HTMLSelectElement;
    const checkbox = container.querySelector(".playground-check input") as HTMLInputElement;
    choose(preset, "columns");
    expect(checkbox.disabled, "a per-dot delay cannot move a highlight").toBe(true);
    expect(container.querySelector(".playground-note")?.textContent).toMatch(/refuses it/);
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
    const preset = [...container.querySelectorAll(".playground-field")]
      .find((row) => /^preset/i.test(row.querySelector("span")?.textContent ?? ""))
      ?.querySelector("select") as HTMLSelectElement;

    // override, switch preset — the dial must NOT follow, because it is overridden
    drag(staggerRow().querySelector("input") as HTMLInputElement, 20);
    choose(preset, "ring");
    expect(Number((staggerRow().querySelector("input") as HTMLInputElement).value)).toBe(20);

    // back to following, and now the preset does move it: ring's spread is 0.34
    act(() => (staggerRow().querySelector(".reset") as HTMLButtonElement).click());
    choose(preset, "ring");
    expect(Number((staggerRow().querySelector("input") as HTMLInputElement).value)).toBe(34);
    expect(staggerRow().querySelector("em")?.textContent).toMatch(/34%/);
  });
});
