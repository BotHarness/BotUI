import { useMemo, useState } from "react";
import {
  DOT_SHAPES,
  DOT_SHAPE_KEYS,
  GLYPH_DEFAULTS,
  PRESETS,
  PRESET_KEYS,
  SILHOUETTE_KEYS,
  cssRenderable,
  glyphPath,
  dotShareOfPitch,
  layout,
  touchingDotSize,
  type DotGlyphSpec,
  type DotMatrixOptions,
  type DotShape,
  type PresetName,
  type Silhouette,
} from "@botharness/botui-core";
import { Matrix } from "./Matrix";

/**
 * The playground: every layer the component exposes, on one field, all of it draggable.
 *
 * The two shapes are sliders rather than dropdowns on purpose. A dot is a POLYGON plus
 * two corner radii — `sides: 3` is a triangle, `sides: 6` a hexagon — so the honest
 * control is the number, and dragging it is how you find out that a 7-gon is a
 * heptagon. The named glyphs are presets over that number, so they stay available as a
 * second control for the shapes `sides` cannot reach: a star is a notch between the
 * points, and a bar is an aspect ratio.
 *
 * The readout matters as much as the sliders. `dot / cell` and `dot / pitch` are
 * different numbers and only one of them means anything to the eye: 100% of the PITCH
 * is two dots touching, and that point moves when the gap changes.
 */
export function Playground() {
  const [options, setOptions] = useState<DotMatrixOptions>({
    size: 150,
    cols: 7,
    rows: 7,
    silhouette: "circle",
    dot: "square",
    spec: { ...DOT_SHAPES.square.spec },
    dotSize: 0.55,
    gapX: 0.45,
    gapY: 0.45,
    preset: "spiral",
    speed: 1,
    grow: 0.5,
    softness: 0,
    stagger: null,
    renderer: "svg",
    // The component's own default floor is 0.16, which is deliberately almost-dark: an
    // indicator should not shout. On a dark page at 150px that reads as an EMPTY box,
    // though, and a demo nobody can see is not a demo. A demo choice, not a component
    // change — the floor slider below moves it.
    floor: 0.32,
  });
  const [cssRenderer, setCssRenderer] = useState(false);

  const set = (patch: Partial<DotMatrixOptions>) => setOptions((o) => ({ ...o, ...patch }));

  /** drive the polygon directly, which is what the `sides` slider is */
  const setSpec = (patch: Partial<DotGlyphSpec>) =>
    set({ dot: "custom", spec: { ...GLYPH_DEFAULTS, ...options.spec, ...patch } });

  const geometry = useMemo(() => layout(options), [options]);
  const pitchShare = dotShareOfPitch(
    options.dotSize ?? 0.55,
    Math.max(options.gapX ?? 0, options.gapY ?? 0),
  );
  const touching = touchingDotSize(Math.max(options.gapX ?? 0, options.gapY ?? 0));

  // a motion the CSS renderer cannot express has to be refused, not approximated — the
  // page says so instead of showing a different animation under the same name
  // the engine's own rule, not a re-statement of it: a caller that checks whether the
  // preset EXISTS instead of whether the renderer can EXPRESS it leaves the checkbox
  // enabled for a motion that has no CSS form
  const cssAvailable = cssRenderable(options.preset);
  const silhouetteIndex = Math.max(0, SILHOUETTE_KEYS.indexOf(options.silhouette ?? "square"));
  const sides = options.spec?.sides ?? GLYPH_DEFAULTS.sides;

  return (
    <div className="playground">
      <div className="playground-stage">
        <Matrix
          {...options}
          renderer={cssRenderer ? "css" : "svg"}
          key={`${options.preset}-${options.silhouette}-${options.cols}x${options.rows}-${options.dot}`}
        />
      </div>

      <div className="playground-controls">
        <Group label="shape · 形状">
          <Slider
            label="整体 silhouette"
            value={silhouetteIndex}
            min={0}
            max={SILHOUETTE_KEYS.length - 1}
            step={1}
            display={options.silhouette ?? "square"}
            onChange={(i) => set({ silhouette: SILHOUETTE_KEYS[i] as Silhouette })}
          />
          <Slider
            label="点 sides"
            value={sides}
            min={3}
            max={10}
            step={1}
            display={POLYGON_NAMES[sides] ?? `${sides}-gon`}
            onChange={(n) => setSpec({ sides: n })}
          />
          <Select
            label="点预设 glyph"
            value={options.dot}
            onChange={(dot) =>
              set({
                dot: dot as DotShape,
                spec: { ...DOT_SHAPES[dot as keyof typeof DOT_SHAPES].spec },
              })
            }
            options={DOT_SHAPE_KEYS.map((key) => ({
              value: key,
              label: DOT_SHAPES[key as keyof typeof DOT_SHAPES].label,
            }))}
          />
          {/* the top of this travel is the polygon's OWN inradius, so dragging it
              all the way always gives a circle — for a triangle, a square and a
              pentagon alike. A fixed 90% would be unreachable for some shapes and
              meaningless for others. */}
          <PercentSlider
            label="圆角 radius"
            fraction={options.spec?.radius ?? 0}
            max={Math.round(inradiusOf(sides) * 100)}
            display={`${Math.round((options.spec?.radius ?? 0) * 100)}% of ${Math.round(inradiusOf(sides) * 100)}%`}
            onChange={(radius) => setSpec({ radius })}
          />
          <PercentSlider
            label="拉伸 aspect"
            fraction={options.spec?.aspect ?? 1}
            min={20}
            max={100}
            display={percent(options.spec?.aspect ?? 1)}
            onChange={(aspect) => setSpec({ aspect })}
          />
        </Group>

        <Group label="size · 尺寸">
          <Slider
            label="size"
            value={options.size ?? 150}
            min={24}
            max={260}
            step={1}
            display={`${options.size}px`}
            onChange={(size) => set({ size })}
          />
          {/* two sliders, not one encoding "7x7" in a range input: Number("7x7") is NaN,
                so the combined control silently set both axes to NaN on the first drag */}
          <Slider
            label="cols"
            value={options.cols ?? 7}
            min={1}
            max={16}
            step={1}
            display={String(options.cols)}
            onChange={(cols) => set({ cols })}
          />
          <Slider
            label="rows"
            value={options.rows ?? 7}
            min={1}
            max={16}
            step={1}
            display={String(options.rows)}
            onChange={(rows) => set({ rows })}
          />
          <Slider
            label="点占格 dot / cell"
            value={Math.round((options.dotSize ?? 0.55) * 100)}
            min={5}
            max={200}
            step={1}
            display={`${Math.round((options.dotSize ?? 0.55) * 100)}%`}
            onChange={(v) => set({ dotSize: v / 100 })}
          />
          <Slider
            label="列 gap x"
            value={Math.round((options.gapX ?? 0) * 100)}
            min={0}
            max={200}
            step={5}
            display={percent(options.gapX ?? 0)}
            onChange={(v) => set({ gapX: v / 100 })}
          />
          <Slider
            label="行 gap y"
            value={Math.round((options.gapY ?? 0) * 100)}
            min={0}
            max={200}
            step={5}
            display={percent(options.gapY ?? 0)}
            onChange={(v) => set({ gapY: v / 100 })}
          />
        </Group>

        <Group label="motion · 动效">
          <Select
            label="preset"
            value={options.preset}
            hint={PRESETS[options.preset ?? "spiral"]?.task}
            onChange={(preset) => set({ preset: preset as PresetName })}
            options={PRESET_KEYS.map((key) => ({ value: key, label: key }))}
          />
          <PercentSlider
            label="速度 speed"
            fraction={options.speed ?? 1}
            min={5}
            max={300}
            display={`${(options.speed ?? 1).toFixed(2)}×`}
            onChange={(speed) => set({ speed })}
          />
          {/* The label states the preset's OWN number rather than the word "preset":
              the thumb is sitting at 95% and a label reading only "preset" tells you
              nothing about where it is. And once you drag, `onReset` is the only way
              back to following the preset — a dial you can leave but not return to is
              a trap, and switching the preset no longer moves this one. */}
          <PercentSlider
            label="错峰 stagger"
            fraction={options.stagger ?? PRESETS[options.preset ?? "spiral"]!.spread}
            max={200}
            display={`${options.stagger == null ? "预设 " : ""}${percentOf(options.stagger ?? PRESETS[options.preset ?? "spiral"]!.spread)}`}
            dirty={options.stagger != null}
            onReset={() => set({ stagger: null })}
            onChange={(stagger) => set({ stagger })}
          />
          <Slider
            label="波宽 softness"
            value={Math.round((options.softness ?? 0) * 100)}
            min={0}
            max={100}
            step={1}
            display={`${Math.round((options.softness ?? 0) * 100)}%`}
            onChange={(v) => set({ softness: v / 100 })}
          />
          <Slider
            label="呼吸 grow"
            value={Math.round((options.grow ?? 0.5) * 100)}
            min={0}
            max={100}
            step={1}
            display={percent(options.grow ?? 0.5)}
            onChange={(v) => set({ grow: v / 100 })}
          />
          <Slider
            label="底噪 floor"
            value={Math.round((options.floor ?? 0.16) * 100)}
            min={0}
            max={100}
            step={1}
            display={percent(options.floor ?? 0.16)}
            onChange={(v) => set({ floor: v / 100 })}
          />
        </Group>

        <label className="playground-check">
          <input
            type="checkbox"
            checked={cssRenderer}
            disabled={!cssAvailable}
            onChange={(e) => setCssRenderer(e.target.checked)}
          />
          CSS renderer <span>0 JS per frame</span>
        </label>
        {!cssAvailable && (
          <p className="playground-note">
            This motion is a highlight <em>moving</em> down the field, and a per-dot delay can only
            offset a phase — so the CSS renderer refuses it rather than showing something else.
          </p>
        )}
      </div>

      <pre className="playground-readout">
        {[
          `dot / cell   ${Math.round((options.dotSize ?? 0) * 100)}%`,
          `dot / pitch  ${Math.round(pitchShare * 100)}%    100% = two dots touching`,
          `touching at  dot / cell = ${touching.toFixed(2)}`,
          `pitch        ${geometry.pitchX.toFixed(1)} × ${geometry.pitchY.toFixed(1)} px`,
          `dot          ${geometry.dotPx.toFixed(1)} px`,
          `silhouette   ${options.silhouette}   dot ${POLYGON_NAMES[sides] ?? `${sides}-gon`}`,
          `renderer     ${cssRenderer ? "css" : "svg"}   speed ${(options.speed ?? 1).toFixed(2)}×`,
        ].join("\n")}
      </pre>
    </div>
  );
}

const POLYGON_NAMES: Record<number, string> = {
  3: "triangle 三角",
  4: "square 方",
  5: "pentagon 五边",
  6: "hexagon 六边",
  7: "heptagon 七边",
  8: "octagon 八边",
  9: "nonagon 九边",
  10: "decagon 十边",
};

const percent = (v: number) => percentOf(v);
const percentOf = (v: number) => `${Math.round(v * 100)}%`;

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <fieldset className="playground-group">
      <legend>{label}</legend>
      {children}
    </fieldset>
  );
}

function Select({
  label,
  value,
  hint,
  options,
  onChange,
}: {
  label: string;
  value: string | undefined;
  hint?: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="playground-field">
      <span>
        {label}
        {hint && <em>{hint}</em>}
      </span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/**
 * A slider for a 0…1 option.
 *
 * The ×100 lives here, once. Three sliders were passing the raw fraction against a
 * track measured in hundredths — radius 0.7 on a 0…90 track, which pins the thumb at
 * the far left and makes the control look dead, and speed 1 on a 5…300 track, which
 * clamps to the minimum and reads as "no effect". A test that only checked "the field
 * changed" passed all three, because the field does change once a value arrives; the
 * defect was in where the THUMB sat, which nothing looked at.
 */
function PercentSlider({
  label,
  fraction,
  min = 0,
  max = 100,
  step = 1,
  display,
  dirty,
  onReset,
  onChange,
}: {
  label: string;
  fraction: number;
  min?: number;
  max?: number;
  step?: number;
  display?: string;
  dirty?: boolean;
  onReset?: () => void;
  onChange: (fraction: number) => void;
}) {
  return (
    <Slider
      label={label}
      value={Math.round(Math.min(Math.max(fraction, 0), 1) * 100)}
      min={min}
      max={max}
      step={step}
      display={display ?? percent(fraction)}
      dirty={dirty}
      onReset={onReset}
      onChange={(v) => onChange(v / 100)}
    />
  );
}

/** the radius at which this polygon's corners are fully rounded — a true circle */
function inradiusOf(sides: number): number {
  return glyphPath({ sides }).inradius;
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  display,
  dirty,
  onReset,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  /** the value is an override rather than the component/preset default */
  dirty?: boolean;
  onReset?: () => void;
  onChange: (value: number) => void;
}) {
  return (
    <label className="playground-field">
      <span>
        {label}
        <em>
          {display}
          {onReset && (
            <button
              type="button"
              className="reset"
              title="回到预设值"
              aria-label={`${label} — 回到预设值`}
              onClick={onReset}
            >
              {dirty ? "\u21ba" : "\u00b7"}
            </button>
          )}
        </em>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}
