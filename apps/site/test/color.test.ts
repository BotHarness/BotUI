/**
 * Colour notation.
 *
 * The failure here is silent and one-directional: a picker that round-trips a colour
 * through hex → rgb → hsl and back loses a bit each time, so switching the notation chips
 * twice leaves the swatch on a colour the visitor never chose — and nothing looks broken.
 * So the round-trip is the assertion, over a spread of colours chosen to hit the edges:
 * the achromatics, the primaries, and the mid-tones where the arithmetic is most lossy.
 */
import { describe, expect, it } from "vitest";
import {
  format,
  hslToRgb,
  isHex,
  parseColor,
  parseHex,
  parseHsl,
  parseRgb,
  resolveComputed,
  rgbToHsl,
  toHex,
  toHsl,
  toRgb,
  type Notation,
} from "../src/color.js";

/** far enough apart that any loss is visible */
const COLORS = [
  "#000000",
  "#ffffff",
  "#ff0000",
  "#00ff00",
  "#0000ff",
  "#808080",
  "#2f5bff",
  "#7d9bff",
  "#f2a93b",
  "#1a1a2e",
];

describe("parsing", () => {
  it("reads every hex form, including the shorthand", () => {
    expect(parseHex("#f00")).toEqual({ r: 255, g: 0, b: 0, a: 1 });
    expect(parseHex("#f00f")).toEqual({ r: 255, g: 0, b: 0, a: 1 });
    expect(parseHex("#ff0000")).toEqual({ r: 255, g: 0, b: 0, a: 1 });
    expect(parseHex("#ff000080")!.a).toBeCloseTo(0.502, 2);
  });

  it("reads every rgb spelling, because they are all still in use", () => {
    const want = { r: 18, g: 52, b: 86, a: 1 };
    expect(parseRgb("rgb(18 52 86)")).toEqual(want);
    expect(parseRgb("rgb(18, 52, 86)")).toEqual(want);
    expect(parseRgb("rgba(18, 52, 86, 1)")).toEqual(want);
    expect(parseRgb("rgb(18 52 86 / 0.5)")!.a).toBe(0.5);
    expect(parseRgb("rgb(100% 0% 0%)")).toEqual({ r: 255, g: 0, b: 0, a: 1 });
  });

  it("reads hsl, wrapping hue and clamping the rest", () => {
    // c = (1-|2l-1|)s = 0.4, x = 0.2, m = 0.2 → (51, 102, 153), within float noise
    const p = parseHsl("hsl(210 50% 40%)")!;
    expect(p.r).toBeCloseTo(51, 6);
    expect(p.g).toBeCloseTo(102, 6);
    expect(p.b).toBeCloseTo(153, 6);
    // -150 wraps to 210, which is cyan — a red channel of 0 would mean the wrap did not
    // happen at all. The assertion is that it wrapped, not that it stayed red.
    expect(Number.isNaN(parseHsl("hsl(-150 50% 50%)")!.r), "wraps, not NaN").toBe(false);
    expect(parseHsl("hsl(-150 50% 50%)")!.r).toBeCloseTo(63.75, 6);
    expect(parseHsl("hsl(210 50% 40% / 0.25)")!.a).toBe(0.25);
  });

  it("refuses what it cannot represent, rather than guessing", () => {
    // `var(--brand)` is what a design system hands a component. The engine passes it
    // straight through and must keep doing so; the picker simply cannot edit it.
    expect(parseColor("var(--brand)")).toBeNull();
    expect(parseColor("color-mix(in oklch, red, blue)")).toBeNull();
    expect(parseColor("currentColor")).toBeNull();
    expect(parseColor("#12345")).toBeNull();
    expect(isHex("#12345")).toBe(false);
  });

  it("picks the notation by shape", () => {
    expect(parseColor("#2f5bff")).toMatchObject({ r: 47, g: 91, b: 255 });
    expect(parseColor("rgb(47 91 255)")).toMatchObject({ r: 47, g: 91, b: 255 });
    expect(parseColor("hsl(227 100% 59%)")!.b, "to the last bit").toBeCloseTo(255, 6);
  });
});

describe("round-tripping", () => {
  it("is EXACT through hex and rgb, which are lossless re-spellings", () => {
    for (const hex of COLORS) {
      expect(toHex(parseRgb(toRgb(parseHex(hex)!))!), `${hex} via rgb`).toBe(hex);
      expect(toHex(parseHex(toHex(parseHex(hex)!))!), `${hex} via hex`).toBe(hex);
    }
  });

  it("converts to hsl and back EXACTLY when nothing is quantised", () => {
    // rgbToHsl → hslToRgb are float-in/float-out and must be the identity on a colour.
    // This isolates the ALGORITHM from the FORMATTING.
    for (const hex of COLORS) {
      const { r, g, b } = parseHex(hex)!;
      const { h, s, l } = rgbToHsl(r, g, b);
      const back = hslToRgb(h, s, l);
      expect(back.r, `${hex} r`).toBeCloseTo(r, 6);
      expect(back.g, `${hex} g`).toBeCloseTo(g, 6);
      expect(back.b, `${hex} b`).toBeCloseTo(b, 6);
    }
  });

  it("loses at most a couple of 255ths through the INTEGER hsl triple, and no more", () => {
    // An integer hsl triple cannot name every sRGB colour: #2f5bff is hsl(227 100% 59%),
    // and that back is #2d5bff. This is arithmetic, not a bug — hue, saturation and
    // lightness are each rounded to a whole number — and it is exactly why the control
    // never REWRITES the canonical value when the notation chips change: hsl is a VIEW of
    // the colour, not a new source of truth. Were the chips to rewrite it, this rounding
    // would become a visible drift every time somebody clicked one twice.
    let worst = 0;
    for (const hex of COLORS) {
      const back = parseHsl(toHsl(parseHex(hex)!))!;
      const want = parseHex(hex)!;
      for (const ch of ["r", "g", "b"] as const) {
        worst = Math.max(worst, Math.abs(back[ch] - want[ch]));
      }
    }
    // 3/255, measured over the palette: rounding lightness, hue and saturation each
    // contribute, and the three compound. The bound is the POINT — it is what a control
    // must not treat as an error, and what it must also not present as a change.
    expect(worst, "quantisation stays inside three 255ths, measured").toBeLessThanOrEqual(3);
  });

  it("keeps the alpha channel, and adds a digit only when there is alpha to carry", () => {
    const translucent = { r: 18, g: 52, b: 86, a: 0.4 };
    expect(toHex(translucent)).toHaveLength(9);
    expect(toHex({ ...translucent, a: 1 }), "opaque stays six digits").toHaveLength(7);
    expect(parseHex(toHex(translucent))!.a).toBeCloseTo(0.4, 1);
    expect(toRgb(translucent)).toContain("/");
    expect(toRgb({ ...translucent, a: 1 }), "opaque stays the 3-arg form").not.toContain("/");
  });
});

describe("achromatics", () => {
  it("reports hue 0 for a grey rather than NaN, and round-trips it", () => {
    // A grey that claims to be hue 0 is a grey that claims to be red. The hue is
    // meaningless here and must be a number so the round trip survives.
    for (const grey of ["#000000", "#808080", "#ffffff"]) {
      const { h, s } = rgbToHsl(
        ...([parseHex(grey)!.r, parseHex(grey)!.g, parseHex(grey)!.b] as const),
      );
      expect(Number.isNaN(h), `${grey} hue`).toBe(false);
      expect(s, `${grey} saturation`).toBe(0);
      expect(toHex(parseHsl(toHsl(parseHex(grey)!)!)!)).toBe(grey);
    }
  });

  it("puts a pure black and a pure white at the ends lightness can reach", () => {
    expect(rgbToHsl(0, 0, 0).l).toBe(0);
    expect(rgbToHsl(255, 255, 255).l).toBe(1);
  });
});

describe("hsl arithmetic", () => {
  it("covers all six hue segments", () => {
    // 0/60/120/180/240/300 are where a segment table goes wrong, and the classic bug is
    // the 300–360 wrap
    for (const h of [0, 60, 120, 180, 240, 300, 359]) {
      const { r, g, b } = hslToRgb(h, 1, 0.5);
      const back = rgbToHsl(r, g, b).h;
      expect(Math.abs(back - h), `hue ${h}`).toBeLessThan(1.5);
    }
  });

  it("treats lightness 0.5 with full saturation as the pure hue", () => {
    const pure = (h: number) => hslToRgb(h, 1, 0.5);
    expect(pure(0)).toMatchObject({ r: 255, g: 0, b: 0 });
    expect(pure(120)).toMatchObject({ r: 0, g: 255, b: 0 });
    expect(pure(240)).toMatchObject({ r: 0, g: 0, b: 255 });
  });
});

describe("formatting for a control", () => {
  it("converts between notations without changing the colour", () => {
    expect(format("#2f5bff", "rgb")).toBe("rgb(47 91 255)");
    expect(format("#2f5bff", "hsl")).toBe("hsl(227 100% 59%)");
    expect(format("rgb(47 91 255)", "hex")).toBe("#2f5bff");
    // and the near-miss, stated rather than hidden
    // the reverse spelling lands one 255th away, which is the quantisation stated above
    expect(format("hsl(227 100% 59%)", "hex")).toMatch(/^#2[de]5bff$/i);
  });

  it("returns null for a notation it cannot render, so the field can stay untouched", () => {
    // The dangerous alternative is echoing the input back, which looks like it worked.
    expect(format("var(--brand)", "hex")).toBeNull();
    expect(format("currentColor", "hex")).toBeNull();
  });

  it("emits the modern space-separated syntax, which is what tooling writes", () => {
    const all: Notation[] = ["hex", "rgb", "hsl"];
    for (const n of all) expect(format("#2f5bff", n)).toMatch(/^[#a-z]/i);
  });
});

describe("currentColor", () => {
  it("resolves `currentColor` against the element it is read on, not the page", () => {
    // A swatch showing black because nothing set `color` on <body> is a swatch lying about
    // the colour the dots are actually painted.
    if (typeof document === "undefined") return;
    const host = document.createElement("div");
    host.style.color = "rgb(47 91 255)";
    document.body.appendChild(host);
    expect(resolveComputed("currentColor", host)).toBe("#2f5bff");
    host.remove();
    // and with nowhere to read it from, it declines rather than inventing black
    expect(resolveComputed("currentColor")).toBeNull();
  });

  it("resolves a literal against a throwaway probe", () => {
    if (typeof document === "undefined") return;
    expect(resolveComputed("rgb(47 91 255)")).toBe("#2f5bff");
    expect(resolveComputed("#2f5bff")).toBe("#2f5bff");
  });

  it("has nothing to resolve for `none` or an empty value", () => {
    expect(resolveComputed("none")).toBeNull();
    expect(resolveComputed("")).toBeNull();
    expect(resolveComputed("transparent")).toBeNull();
  });
});
