import { useMemo, useState } from "react";
import {
  DOT_SHAPES,
  DOT_SHAPE_KEYS,
  PRESETS,
  PRESET_KEYS,
  SILHOUETTE_KEYS,
  dotShareOfPitch,
  layout,
  touchingDotSize,
  type DotMatrixOptions,
  type DotShape,
  type PresetName,
  type Silhouette,
} from "@botharness/botui-core";
import { Matrix } from "./Matrix";

/**
 * The playground: every layer the component exposes, on one field.
 *
 * The readout is the point, not the sliders. `dot / cell` and `dot / pitch` are
 * different numbers and only one of them means anything to the eye — 100% of the
 * PITCH is two dots touching, and that point moves when the gap changes. Showing
 * both, and the value at which they coincide, is what stops the dial from being
 * mysterious.
 */
export function Playground() {
  const [options, setOptions] = useState<DotMatrixOptions>({
    size: 140,
    cols: 7,
    rows: 7,
    silhouette: "circle",
    dot: "square",
    spec: { ...DOT_SHAPES.square.spec },
    dotSize: 0.55,
    gapX: 0.45,
    gapY: 0.45,
    preset: "spiral",
    softness: 0,
    renderer: "svg",
    // The component's own default floor is 0.16, which is deliberately almost-dark:
    // an indicator should not shout. On a dark page at 140px that reads as an EMPTY
    // box, though, and a demo nobody can see is not a demo. The floor is a demo
    // choice, not a component change — the slider below moves it.
    floor: 0.32,
  });
  const [cssRenderer, setCssRenderer] = useState(false);

  const set = (patch: Partial<DotMatrixOptions>) => setOptions((o) => ({ ...o, ...patch }));

  const geometry = useMemo(() => layout(options), [options]);
  const pitchShare = dotShareOfPitch(
    options.dotSize ?? 0.55,
    Math.max(options.gapX ?? 0, options.gapY ?? 0),
  );
  const touching = touchingDotSize(Math.max(options.gapX ?? 0, options.gapY ?? 0));

  // a motion the CSS renderer cannot express has to be refused, not silently
  // approximated — the page says so instead of showing the wrong animation
  const cssGap = PRESETS[options.preset ?? "spiral"];
  const cssAvailable = Boolean(cssGap);

  return (
    <div className="playground">
      <div className="playground-stage">
        <Matrix
          {...options}
          renderer={cssRenderer ? "css" : "svg"}
          key={`${options.preset}-${options.silhouette}-${options.cols}x${options.rows}`}
        />
      </div>

      <div className="playground-controls">
        <Field label="preset" hint={PRESETS[options.preset ?? "spiral"]?.task}>
          <select
            value={options.preset}
            onChange={(e) => set({ preset: e.target.value as PresetName })}
          >
            {PRESET_KEYS.map((key) => (
              <option key={key} value={key}>
                {key}
              </option>
            ))}
          </select>
        </Field>

        <Field label="silhouette">
          <select
            value={options.silhouette}
            onChange={(e) => set({ silhouette: e.target.value as Silhouette })}
          >
            {SILHOUETTE_KEYS.map((key) => (
              <option key={key} value={key}>
                {key}
              </option>
            ))}
          </select>
        </Field>

        <Field label="dot">
          <select
            value={options.dot}
            onChange={(e) => {
              const dot = e.target.value as DotShape;
              set({ dot, spec: { ...DOT_SHAPES[dot as keyof typeof DOT_SHAPES].spec } });
            }}
          >
            {DOT_SHAPE_KEYS.map((key) => (
              <option key={key} value={key}>
                {DOT_SHAPES[key as keyof typeof DOT_SHAPES].label}
              </option>
            ))}
          </select>
        </Field>

        <Slider
          label="size"
          value={options.size ?? 140}
          min={24}
          max={220}
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
          max={14}
          step={1}
          display={String(options.cols)}
          onChange={(cols) => set({ cols })}
        />
        <Slider
          label="rows"
          value={options.rows ?? 7}
          min={1}
          max={14}
          step={1}
          display={String(options.rows)}
          onChange={(rows) => set({ rows })}
        />
        <Slider
          label="dot / cell"
          value={Math.round((options.dotSize ?? 0.55) * 100)}
          min={5}
          max={200}
          step={1}
          display={`${Math.round((options.dotSize ?? 0.55) * 100)}%`}
          onChange={(v) => set({ dotSize: v / 100 })}
        />
        <Slider
          label="gap x"
          value={Math.round((options.gapX ?? 0) * 100)}
          min={0}
          max={200}
          step={5}
          display={`${((options.gapX ?? 0) * 100).toFixed(0)}%`}
          onChange={(v) => set({ gapX: v / 100 })}
        />
        <Slider
          label="gap y"
          value={Math.round((options.gapY ?? 0) * 100)}
          min={0}
          max={200}
          step={5}
          display={`${((options.gapY ?? 0) * 100).toFixed(0)}%`}
          onChange={(v) => set({ gapY: v / 100 })}
        />
        <Slider
          label="softness"
          value={Math.round((options.softness ?? 0) * 100)}
          min={0}
          max={100}
          step={1}
          display={`${Math.round((options.softness ?? 0) * 100)}%`}
          onChange={(v) => set({ softness: v / 100 })}
        />

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
          `renderer     ${cssRenderer ? "css" : "svg"}`,
        ].join("\n")}
      </pre>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="playground-field">
      <span>
        {label}
        {hint && <em>{hint}</em>}
      </span>
      {children}
    </label>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  display,
  onChange,
}: {
  label: string;
  value: number | string;
  min: number;
  max: number;
  step: number;
  display: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="playground-field">
      <span>
        {label}
        <em>{display}</em>
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
