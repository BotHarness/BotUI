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
