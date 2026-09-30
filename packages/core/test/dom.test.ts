// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
  ENVELOPES,
  PRESETS,
  PRESET_KEYS,
  buildCss,
  buildSvg,
  createDotMatrix,
  ensureStylesheet,
  field,
  keyframesFor,
  layout,
  maskFor,
  resolveOptions,
  softLevel,
  stylesheet,
  type DotMatrixOptions,
} from "../src/index.js";

const base: DotMatrixOptions = { cols: 5, rows: 5, size: 200, gapX: 0, gapY: 0 };

describe("the field", () => {
  it("is a pure function of (options, t) — no clock, so it is seekable", () => {
    const a = field({ ...base, preset: "spiral" }, 0.3);
    const b = field({ ...base, preset: "spiral" }, 0.3);
    expect(a).toEqual(b);
    expect(field({ ...base, preset: "spiral" }, 0.31)).not.toEqual(a);
  });

  it("puts every dot inside the box, at any dot size", () => {
    // the invariant that lets the component need no clipping margin. The tolerance
    // is the field's own serialisation precision: positions are rounded to 3
    // decimals so a frame is stable and diffable, and at dotSize 2 that rounding is
    // worth 3e-4 of a pixel on a 200px box.
    for (const dotSize of [0.05, 1, 2, 3]) {
      const o = { ...base, dotSize };
      const L = layout(o);
      for (const d of field(o, 0.4)) {
        expect(Math.abs(d.x) + L.dotPx / 2, `x at dotSize ${dotSize}`).toBeLessThanOrEqual(
          100 + 1e-3,
        );
        expect(Math.abs(d.y) + L.dotPx / 2, `y at dotSize ${dotSize}`).toBeLessThanOrEqual(
          100 + 1e-3,
        );
      }
    }
  });

  it("is centred, and a trim silhouette stays centred", () => {
    for (const silhouette of ["square", "circle", "diamond", "ring", "cross"] as const) {
      const dots = field({ ...base, silhouette, preset: "spiral" }, 0.4);
      const xs = dots.map((d) => d.x);
      const ys = dots.map((d) => d.y);
      expect((Math.min(...xs) + Math.max(...xs)) / 2, silhouette).toBeCloseTo(0, 6);
      expect((Math.min(...ys) + Math.max(...ys)) / 2, silhouette).toBeCloseTo(0, 6);
    }
  });

  it("carries the same glyph path on every dot", () => {
    const shapes = ["square", "circle", "star5", "drop"] as const;
    for (const dot of shapes) {
      const paths = new Set(field({ ...base, dot }, 0.4).map((d) => d.d));
      expect(paths.size, dot).toBe(1);
    }
  });

  it("a quantised order cannot be smoothed by the envelope", () => {
    // why `ripple` rides `radial`: with four levels in the order, the field is four
    // bands no matter how smooth the wave is. No amount of envelope work reaches it.
    const distinctOrders = (preset: "ring" | "ripple") =>
      new Set(field({ ...base, preset, cols: 7, rows: 7 }, 0.2).map((d) => d.order)).size;
    expect(distinctOrders("ring")).toBeLessThanOrEqual(5);
    expect(distinctOrders("ripple")).toBeGreaterThan(distinctOrders("ring"));
  });

  it("stagger 0 makes every dot identical, and nothing travels", () => {
    const at = (t: number, stagger: number | null) =>
      field({ ...base, preset: "spiral", stagger }, t).map((d) => d.v);
    for (const t of [0.05, 0.2, 0.37, 0.5, 0.81]) {
      expect(new Set(at(t, 0)).size, `t=${t}`).toBe(1);
    }
    // it is a uniform pulse over TIME, not a frozen field
    expect(at(0.2, 0)).not.toEqual(at(0.5, 0));
    expect(at(0.2, 0.7)).not.toEqual(at(0.5, 0.7));
  });

  it("opacity stays inside [floor, peak] and v inside [0, 1]", () => {
    for (const preset of PRESET_KEYS) {
      if (preset === "off") continue;
      for (const t of [0, 0.13, 0.5, 0.77, 0.99]) {
        for (const d of field({ ...base, preset, floor: 0.2, peak: 0.9 }, t)) {
          expect(d.opacity, `${preset}@${t}`).toBeGreaterThanOrEqual(0.2 - 1e-9);
          expect(d.opacity, `${preset}@${t}`).toBeLessThanOrEqual(0.9 + 1e-9);
          expect(d.v, `${preset}@${t}`).toBeGreaterThanOrEqual(0);
          expect(d.v, `${preset}@${t}`).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it("is empty for the off preset, not a field of nothing", () => {
    expect(field({ ...base, preset: "off" }, 0.4)).toEqual([]);
  });
});

describe("the SVG renderer", () => {
  it("uses the component box as its viewBox, with no unit conversion", () => {
    const o = { ...base, size: 64 };
    const svg = buildSvg(o, 0.2);
    expect(svg.getAttribute("viewBox")).toBe("-32 -32 64 64");
    expect(svg.getAttribute("width")).toBe("64");
  });

  it("paints exactly the records the field returns", () => {
    const o: DotMatrixOptions = { ...base, dot: "star5" };
    expect(buildSvg(o, 0.2).querySelectorAll("path")).toHaveLength(field(o, 0.2).length);
  });

  it("puts one path per kept cell, so the holes stay holes", () => {
    for (const silhouette of ["circle", "ring", "diamond", "hex", "cross"] as const) {
      const o = { ...base, cols: 7, rows: 7, silhouette };
      expect(buildSvg(o, 0.2).querySelectorAll("path")).toHaveLength(field(o, 0.2).length);
    }
  });
});

describe("the CSS renderer", () => {
  it("names every cell, because auto-placement would slide the field into a corner", () => {
    const host = buildCss({ ...base, cols: 7, rows: 7, silhouette: "circle" })!;
    const areas = [...host.children].map((c) => (c as HTMLElement).style.gridArea);
    // a circle on 7×7 keeps 29 cells, and each one must carry its own address
    expect(areas).toHaveLength(29);
    expect(new Set(areas).size).toBe(29);
    expect(areas).toContain("4 / 4"); // the middle
    expect(areas).not.toContain("1 / 1"); // a corner, which a circle drops
  });

  it("writes the SAME px layout the SVG renderer used", () => {
    const o = { ...base, size: 180, cols: 6, rows: 4, gapX: 0.2, gapY: 0.6, dotSize: 0.7 };
    const host = buildCss(o)!;
    const L = layout(o);
    expect(host.style.width).toBe("180px");
    expect(host.style.gridTemplateColumns).toBe(`repeat(6, ${L.pitchX.toFixed(2)}px)`);
    expect(host.style.gridTemplateRows).toBe(`repeat(4, ${L.pitchY.toFixed(2)}px)`);
    // never 1fr: that divides the box between tracks and ignores the field's pitch
    expect(host.style.gridTemplateColumns).not.toContain("fr");
  });

  it("reaches the dot-size dial at all", () => {
    // `contain` would pin every dot to 100% of its cell and the dial would do
    // nothing, so --botui-fill has to be the dot's real share
    const thin = buildCss({ ...base, dotSize: 0.2 })!;
    const fat = buildCss({ ...base, dotSize: 1.45 })!;
    expect(Number(fat.style.getPropertyValue("--botui-fill"))).toBeGreaterThan(
      Number(thin.style.getPropertyValue("--botui-fill")),
    );
  });

  it("seeds each cell with a NEGATIVE delay, so the field is moving on frame one", () => {
    const host = buildCss({ ...base, preset: "spiral" })!;
    // a positive delay leaves the first cells at the floor for a whole cycle
    expect(Number(host.style.getPropertyValue("--botui-seed"))).toBeLessThan(0);
    expect(Number(host.style.getPropertyValue("--botui-seed"))).toBe(-PRESETS.spiral.spread);
  });

  it("masks with the SAME path the SVG renderer draws", () => {
    const host = buildCss({ ...base, dot: "star5" })!;
    const mask = host.style.getPropertyValue("--botui-mask");
    expect(mask).toContain(
      encodeURIComponent(field({ ...base, dot: "star5" }, 0)[0]!.d.slice(0, 40)),
    );
    expect(mask).toBe(maskFor(field({ ...base, dot: "star5" }, 0)[0]!.d));
  });

  it("refuses the one motion a per-dot delay cannot express", () => {
    // a highlight MOVING down a column is not a phase offset
    expect(buildCss({ ...base, preset: "columns" })).toBeNull();
    expect(buildCss({ ...base, preset: "off" })).toBeNull();
    expect(buildCss({ ...base, preset: "spiral" })).not.toBeNull();
  });

  it("uses linear timing for every motion, because no envelope is quantised", () => {
    // There used to be a `steps` branch: an envelope could declare `steps: 3`, the field
    // switched the host to `steps(3, end)` timing, and the motion rendered as three
    // shelves. `chase` was the only user, and it was the reason `chasing` read as unsmooth
    // — so the branch went with it. This asserts the shape of what replaced it: every
    // envelope interpolates, therefore every host gets linear timing.
    // `applyCssVars` only runs on the CSS path, and it writes to the field the engine
    // BUILDS inside the mount point — not to the mount point itself
    const mount = document.createElement("div");
    const dm = createDotMatrix(mount, { preset: "ring", renderer: "css" });
    const field = mount.querySelector<HTMLElement>(".botui-dot-matrix");
    expect(field, "the CSS renderer builds a field").toBeTruthy();
    expect(field!.dataset.timing, "every CSS host gets linear timing").toBe("linear");
    dm.destroy();
  });
});

describe("the CSS and SVG renderers agree", () => {
  it("the keyframe curve IS the envelope, sampled — not a lookalike", () => {
    // CSS interpolates linearly between keyframes, so sampling the emitted list has
    // to reproduce what the SVG renderer evaluates. This is the test that catches a
    // change made to one renderer only.
    const curve = (css: string) => {
      const ps = [...css.matchAll(/([\d.]+)%\{/g)].map((m) => Number(m[1]) / 100);
      const vs = [...css.matchAll(/opacity:[^;]*?\*\s*([\d.]+)\)/g)].map((m) => Number(m[1]));
      return (p: number) => {
        if (p <= ps[0]!) return vs[0]!;
        for (let i = 1; i < ps.length; i++) {
          if (p <= ps[i]!) {
            const f = (p - ps[i - 1]!) / (ps[i]! - ps[i - 1]!);
            return vs[i - 1]! + (vs[i]! - vs[i - 1]!) * f;
          }
        }
        return vs[vs.length - 1]!;
      };
    };
    for (const preset of PRESET_KEYS) {
      if (preset === "off" || !PRESETS[preset]!.css) continue;
      const env = ENVELOPES[PRESETS[preset]!.env];
      for (const softness of [0, 0.5, 0.9]) {
        const c = curve(keyframesFor(preset, softness)!);
        for (let i = 0; i <= 40; i++) {
          const p = i / 40;
          expect(
            Math.abs(c(p) - softLevel(p, env, softness)),
            `${preset} softness=${softness} p=${p.toFixed(2)}`,
          ).toBeLessThan(5e-3);
        }
      }
    }
  });

  it("the dot the CSS track reserves is the dot the SVG path draws", () => {
    const o = { ...base, dotSize: 0.9 };
    const L = layout(o);
    const host = buildCss(o)!;
    const fill = Number(host.style.getPropertyValue("--botui-fill"));
    // --botui-fill is the dot's share of its TRACK, and the track is the pitch
    expect(fill * L.pitchX).toBeCloseTo(L.dotPx, 3);
  });
});

describe("the stylesheet", () => {
  it("ships a keyframe rule for every CSS-expressible preset", () => {
    const css = stylesheet(0);
    for (const preset of PRESET_KEYS) {
      if (preset === "off" || !PRESETS[preset]!.css) continue;
      expect(css, preset).toContain(`@keyframes botui-dm-${preset}`);
    }
  });

  it("animates opacity AND scale, because opacity alone reads as a lampshade", () => {
    const css = stylesheet(0);
    expect(css).toMatch(/@keyframes botui-dm-spiral\{[^}]*scale:/);
    expect(css).toMatch(/@keyframes botui-dm-spiral\{[^}]*opacity:/);
  });

  it("holds a static gradient under reduced motion, rather than freezing a frame", () => {
    // a loading indicator that never resolves is worse than one that is simply still
    expect(stylesheet(0)).toContain("prefers-reduced-motion: reduce");
  });

  it("regenerates for a different softness", () => {
    expect(stylesheet(0.9)).not.toBe(stylesheet(0));
  });

  it("only touches the DOM when the text actually changed", () => {
    // rewriting a <style> restarts every animation in it, which is a visible stutter
    document.head.innerHTML = "";
    const a = ensureStylesheet(document, 0);
    const text = a.textContent;
    ensureStylesheet(document, 0);
    expect(a.textContent).toBe(text);
    expect(document.querySelectorAll("style")).toHaveLength(1);
    ensureStylesheet(document, 0.6);
    expect(a.textContent).not.toBe(text);
  });
});

describe("createDotMatrix", () => {
  it("mounts, exposes a copy of its options, and cannot be mutated through it", () => {
    const el = document.createElement("div");
    const dm = createDotMatrix(el, base);
    expect(el.querySelector("svg")).not.toBeNull();
    const snapshot = dm.options;
    snapshot.size = 9999;
    expect(dm.options.size).toBe(200);
    dm.destroy();
  });

  it("hands back the frame without painting it", () => {
    const el = document.createElement("div");
    const dm = createDotMatrix(el, base);
    const painted = el.querySelectorAll("path").length;
    expect(dm.field(0.77)).toHaveLength(painted);
    dm.destroy();
  });

  it("re-paints on set, and the new options are the ones used", () => {
    const el = document.createElement("div");
    const dm = createDotMatrix(el, base);
    dm.set({ cols: 3, rows: 3, silhouette: "square" });
    expect(el.querySelectorAll("path")).toHaveLength(9);
    expect(dm.options.cols).toBe(3);
    dm.destroy();
  });

  it("switches renderer without leaving the old one behind", () => {
    const el = document.createElement("div");
    const dm = createDotMatrix(el, base);
    expect(el.querySelector("svg")).not.toBeNull();
    dm.set({ renderer: "css" });
    expect(el.querySelector("svg")).toBeNull();
    expect(el.querySelector(".botui-dot-matrix")).not.toBeNull();
    dm.set({ renderer: "svg" });
    expect(el.querySelector(".botui-dot-matrix")).toBeNull();
    dm.destroy();
  });

  it("explains why a preset has no CSS form instead of rendering nothing", () => {
    const el = document.createElement("div");
    const dm = createDotMatrix(el, { ...base, renderer: "css" });
    expect(dm.cssGap()).toBeNull();
    dm.set({ preset: "columns" });
    expect(dm.cssGap()).toMatch(/no CSS equivalent/);
    dm.set({ preset: "off" });
    expect(dm.cssGap()).toMatch(/off/);
    dm.destroy();
  });

  it("is inert after destroy, and leaves the element empty", () => {
    const el = document.createElement("div");
    const dm = createDotMatrix(el, base);
    dm.destroy();
    expect(el.childNodes).toHaveLength(0);
    expect(() => dm.start()).not.toThrow();
  });

  it("clamps a seek to a real phase", () => {
    const el = document.createElement("div");
    const dm = createDotMatrix(el, base);
    dm.t = Number.NaN;
    expect(dm.t).toBe(0);
    dm.t = 2.5;
    expect(dm.t).toBe(2.5);
    dm.destroy();
  });

  it("resolves every option, so nothing has to be re-defaulted downstream", () => {
    expect(resolveOptions().renderer).toBe("svg");
    expect(resolveOptions({ stagger: undefined }).stagger).toBeNull();
    expect(resolveOptions({ spec: { sides: 6 } }).spec.sides).toBe(6);
    // a partial spec does not erase the rest of the polygon
    expect(resolveOptions({ spec: { sides: 6 } }).spec.radius).toBe(0);
  });
});
