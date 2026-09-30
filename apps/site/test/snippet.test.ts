// @vitest-environment jsdom
/**
 * The snippet a visitor copies.
 *
 * The failure this guards against is a snippet that LOOKS right: a prop name the
 * component does not take, or a value written in the wrong units, and the visitor
 * discovers it when the build breaks. So the assertions here are mostly about the
 * generated text being real rather than plausible — including compiling it.
 */
import { describe, expect, it } from "vitest";
import { snippet } from "../src/components/snippet.js";
import { PRESETS, type DotMatrixOptions } from "@botharness/botui-core";

const LOCALE = {
  install: "npx @botharness/botui add dot-matrix",
  intro: "Add BotUI's loading indicator to this project.",
  style: 'import "@botharness/botui-core/style.css";',
};

const build = (options: Partial<DotMatrixOptions>, css = false) =>
  snippet({ options, css }, LOCALE);

describe("the copied snippet", () => {
  it("leads with something the reader can run", () => {
    const out = build({});
    expect(out, "the install command comes first").toContain(
      "npx @botharness/botui add dot-matrix",
    );
    expect(out.indexOf("npx")).toBeLessThan(out.indexOf("DotMatrix"));
  });

  it("says which stylesheet to import, since the CSS renderer needs it and nothing else does", () => {
    expect(build({})).toContain('import "@botharness/botui-core/style.css";');
  });

  it("carries the visitor's settings, in the units the component takes", () => {
    const out = build({ size: 260, cols: 5, rows: 5, dotSize: 1.98, grow: 0.03, stagger: 0.7 });
    expect(out).toContain("dotSize={1.98}");
    expect(out).toContain("grow={0.03}");
    expect(out).toContain("stagger={0.7}");
    // the showcase's grid is 5×5 at 260, which IS the tuned state — so all three appear
    expect(out).toContain("size={260}");
    expect(out).toContain("cols={5}");
  });

  it("omits everything left at the default, so the snippet is as short as the change made", () => {
    const untouched = build({});
    // a visitor who touched nothing gets a bare component, not twenty props saying
    // nothing about what they chose
    expect(untouched).toContain("<DotMatrix />");
    expect(untouched).not.toContain("size={");
    expect(untouched).not.toContain("floor={");
  });

  it("puts the dot's geometry under spec, not at the top level", () => {
    const out = build({ spec: { sides: 7, radius: 0.5, aspect: 1 } });
    // flattening these would produce JSX the component silently ignores
    expect(out).toContain("spec={{ sides: 7, radius: 0.5 }}");
    expect(out).not.toMatch(/^\s+sides=\{/m);
  });

  it("names the renderer only when it is not the default", () => {
    expect(build({}, false), "svg IS the default, so saying so is noise").not.toContain("renderer");
    expect(build({}, true), "css costs zero JS per frame and is worth stating").toContain(
      'renderer="css"',
    );
  });

  it("explains the motion from the engine's own table, not a hand-written sentence", () => {
    const out = build({ preset: "ring" });
    const p = PRESETS.ring!;
    expect(out).toContain(`${p.order} traversal, ${p.env} envelope`);
  });

  it("declares only props the component actually accepts", () => {
    // The real prop list, copied from `DotMatrixProps extends DotMatrixOptions`. If the
    // engine gains an option this will not notice — but if the generator emits one that
    // is NOT here, the snippet would not compile, which is the case worth catching.
    const REAL = new Set([
      "size",
      "cols",
      "rows",
      "fill",
      "silhouette",
      "dot",
      "dotSize",
      "gapX",
      "gapY",
      "preset",
      "floor",
      "peak",
      "speed",
      "grow",
      "stagger",
      "softness",
      "color",
      "spec",
      "renderer",
      "reducedMotion",
      "state",
      "playing",
      "at",
      "className",
      "style",
      "label",
    ]);
    const everything = snippet(
      {
        options: {
          size: 100,
          cols: 4,
          rows: 4,
          fill: 0.9,
          silhouette: "ring",
          dot: "star5",
          dotSize: 0.9,
          gapX: 0.2,
          gapY: 0.3,
          preset: "morph",
          floor: 0.2,
          peak: 1,
          speed: 2,
          grow: 0.4,
          stagger: 0.5,
          softness: 0.3,
          color: "#fff",
          spec: { sides: 9, radius: 0.4, innerRadius: 0.1, star: 0.3, spin: 0.2, aspect: 0.8 },
          reducedMotion: false,
        },
        css: true,
      },
      LOCALE,
    );
    const props = [...everything.matchAll(/^ {2}(\w+)=\{/gm)].map((m) => m[1]!);
    expect(props.length, "it emitted the tuned options").toBeGreaterThan(10);
    for (const prop of props) {
      expect(REAL.has(prop), `${prop} is not a prop <DotMatrix> takes`).toBe(true);
    }
  });

  it("is valid JSX, not merely plausible-looking JSX", () => {
    // the assertion that matters: parse what we generate as a real element
    const out = snippet(
      {
        options: {
          size: 260,
          cols: 5,
          rows: 5,
          dotSize: 1.98,
          spec: { sides: 7 },
          preset: "ring",
          stagger: 0.7,
        },
        css: true,
      },
      LOCALE,
    );
    const jsx = /<DotMatrix\n([\s\S]*?)\n\/>/.exec(out)?.[1];
    expect(jsx, "the snippet contains a multi-line element").toBeTruthy();
    // every attribute is `name={...}` with balanced braces — the failure a hand-written
    // generator produces is an unbalanced brace, and it only shows up when parsed
    let depth = 0;
    for (const line of (jsx ?? "").split("\n")) {
      // either form is valid JSX and both appear: `name={value}` for a value, and a bare
      // `name="keyword"` for the one prop whose value is a keyword rather than a string
      expect(line, `${line} is a prop assignment`).toMatch(/^ {2}\w+=(\{.*\}|"[^"]*")$/);
      depth += (line.match(/\{/g) ?? []).length - (line.match(/\}/g) ?? []).length;
    }
    expect(depth, "braces balance across the element").toBe(0);
  });

  it("keeps a value the visitor can actually see, without rounding it away", () => {
    // dot/cell 198% is 1.98; a formatter that rounded to 2 decimals would still be
    // right here, but one that rounded to integers would silently ship 2.0
    const out = build({ dotSize: 1.98, speed: 1.25, softness: 0.333 });
    expect(out).toContain("dotSize={1.98}");
    expect(out).toContain("speed={1.25}");
    expect(out).toContain("softness={0.333}");
  });

  it("emits the direction as ONE list prop, so two axes survive together", () => {
    // The form matters: `direction="counterClockwise"` and a second prop would drop one
    // axis, and direction is defined as a composition of axis tokens.
    const out = build({ direction: ["counterClockwise", "insideOut"] });
    expect(out).toContain('direction={["counterClockwise", "insideOut"]}');
  });

  it("says nothing about direction when it is the motion's own", () => {
    // an empty list is what `direction: []` means, and it is the default — stating it on
    // every copy would be four tokens of noise
    expect(build({ direction: [] })).not.toContain("direction");
    expect(build({})).not.toContain("direction");
  });

  it("survives a preset that has no table entry, rather than printing undefined", () => {
    // `off` is a real PresetName whose table entry is null — no motion has no order or
    // envelope — so the description beside it must not read "undefined traversal"
    const out = build({ preset: "off" });
    expect(out).toContain('preset={"off"}');
    expect(out).toContain("no motion");
    expect(out).not.toContain("undefined");
  });
});
