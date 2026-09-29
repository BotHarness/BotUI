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
import { m, glyphLabel, polygonName, silhouetteLabel, taskLabel } from "../i18n.js";
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
        <Group label={m.group_shape()}>
          <Slider
            label={m.ctl_silhouette()}
            value={silhouetteIndex}
            min={0}
            max={SILHOUETTE_KEYS.length - 1}
            step={1}
            display={silhouetteLabel(options.silhouette ?? "square")}
            onChange={(i) => set({ silhouette: SILHOUETTE_KEYS[i] as Silhouette })}
          />
          <Slider
            label={m.ctl_sides()}
            value={sides}
            min={3}
            max={10}
            step={1}
            display={polygonName(sides)}
            onChange={(n) => setSpec({ sides: n })}
          />
          <Select
            label={m.ctl_glyph()}
            value={options.dot}
            onChange={(dot) =>
              set({
                dot: dot as DotShape,
                spec: { ...DOT_SHAPES[dot as keyof typeof DOT_SHAPES].spec },
              })
            }
            options={DOT_SHAPE_KEYS.map((key) => ({
              value: key,
              label: glyphLabel(key),
            }))}
          />
          {/* the top of this travel is the polygon's OWN inradius, so dragging it
              all the way always gives a circle — for a triangle, a square and a
              pentagon alike. A fixed 90% would be unreachable for some shapes and
              meaningless for others. */}
          <PercentSlider
            label={m.ctl_radius()}
            fraction={options.spec?.radius ?? 0}
            max={Math.round(inradiusOf(sides) * 100)}
            display={m.value_radius({
              value: String(Math.round((options.spec?.radius ?? 0) * 100)),
              max: String(Math.round(inradiusOf(sides) * 100)),
            })}
            onChange={(radius) => setSpec({ radius })}
          />
          <PercentSlider
            label={m.ctl_aspect()}
            fraction={options.spec?.aspect ?? 1}
            min={20}
            max={100}
            display={percent(options.spec?.aspect ?? 1)}
            onChange={(aspect) => setSpec({ aspect })}
          />
        </Group>

        <Group label={m.group_size()}>
          <Slider
            label={m.ctl_size()}
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
            label={m.ctl_cols()}
            value={options.cols ?? 7}
            min={1}
            max={16}
            step={1}
            display={String(options.cols)}
            onChange={(cols) => set({ cols })}
          />
          <Slider
            label={m.ctl_rows()}
            value={options.rows ?? 7}
            min={1}
            max={16}
            step={1}
            display={String(options.rows)}
            onChange={(rows) => set({ rows })}
          />
          <Slider
            label={m.ctl_dot_cell()}
            value={Math.round((options.dotSize ?? 0.55) * 100)}
            min={5}
            max={200}
            step={1}
            display={`${Math.round((options.dotSize ?? 0.55) * 100)}%`}
            onChange={(v) => set({ dotSize: v / 100 })}
          />
          <Slider
            label={m.ctl_gap_x()}
            value={Math.round((options.gapX ?? 0) * 100)}
            min={0}
            max={200}
            step={5}
            display={percent(options.gapX ?? 0)}
            onChange={(v) => set({ gapX: v / 100 })}
          />
          <Slider
            label={m.ctl_gap_y()}
            value={Math.round((options.gapY ?? 0) * 100)}
            min={0}
            max={200}
            step={5}
            display={percent(options.gapY ?? 0)}
            onChange={(v) => set({ gapY: v / 100 })}
          />
        </Group>

        <Group label={m.group_motion()}>
          <Select
            label={m.ctl_preset()}
            value={options.preset}
            hint={taskLabel(options.preset ?? "spiral")}
            onChange={(preset) => set({ preset: preset as PresetName })}
            options={PRESET_KEYS.map((key) => ({ value: key, label: key }))}
          />
          <PercentSlider
            label={m.ctl_speed()}
            fraction={options.speed ?? 1}
            min={5}
            max={300}
            display={m.value_speed({ value: (options.speed ?? 1).toFixed(2) })}
            onChange={(speed) => set({ speed })}
          />
          {/* The label states the preset's OWN number rather than the word "preset":
              the thumb is sitting at 95% and a label reading only "preset" tells you
              nothing about where it is. And once you drag, `onReset` is the only way
              back to following the preset — a dial you can leave but not return to is
              a trap, and switching the preset no longer moves this one. */}
          <PercentSlider
            label={m.ctl_stagger()}
            fraction={options.stagger ?? PRESETS[options.preset ?? "spiral"]!.spread}
            max={200}
            display={
              options.stagger == null
                ? m.value_preset({
                    value: percentOf(
                      options.stagger ?? PRESETS[options.preset ?? "spiral"]!.spread,
                    ),
                  })
                : percentOf(options.stagger)
            }
            dirty={options.stagger != null}
            onReset={() => set({ stagger: null })}
            onChange={(stagger) => set({ stagger })}
          />
          <Slider
            label={m.ctl_softness()}
            value={Math.round((options.softness ?? 0) * 100)}
            min={0}
            max={100}
            step={1}
            display={`${Math.round((options.softness ?? 0) * 100)}%`}
            onChange={(v) => set({ softness: v / 100 })}
          />
          <Slider
            label={m.ctl_grow()}
            value={Math.round((options.grow ?? 0.5) * 100)}
            min={0}
            max={100}
            step={1}
            display={percent(options.grow ?? 0.5)}
            onChange={(v) => set({ grow: v / 100 })}
          />
          <Slider
            label={m.ctl_floor()}
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
          {m.css_renderer()} <span>{m.css_renderer_note()}</span>
        </label>
        {!cssAvailable && <p className="playground-note">{m.css_refused()}</p>}
      </div>

      <pre className="playground-readout">
        {[
          `${m.readout_dot_cell()}   ${Math.round((options.dotSize ?? 0) * 100)}%`,
          `${m.readout_dot_pitch()}  ${Math.round(pitchShare * 100)}%    ${m.readout_touching_hint()}`,
          `${m.readout_touching()}  ${m.readout_touching_value({ value: touching.toFixed(2) })}`,
          `${m.readout_pitch()}        ${geometry.pitchX.toFixed(1)} × ${geometry.pitchY.toFixed(1)} px`,
          `${m.readout_dot()}          ${geometry.dotPx.toFixed(1)} px`,
          `${m.readout_silhouette()}   ${silhouetteLabel(options.silhouette ?? "square")}   dot ${polygonName(sides)}`,
          `${m.readout_renderer()}     ${cssRenderer ? "css" : "svg"}   ${m.readout_speed()} ${m.value_speed({ value: (options.speed ?? 1).toFixed(2) })}`,
        ].join("\n")}
      </pre>
    </div>
  );
}

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
              title={m.ctl_reset()}
              aria-label={m.ctl_reset_aria({ label })}
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
