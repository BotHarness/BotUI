import { useMemo, useState } from "react";
import { LiveCard, Matrix, Still } from "./Matrix.js";
import { CardGroup, SilhouetteCard } from "./Cards.js";
import { ShowcaseCopy } from "./ShowcaseCopy.js";
import {
  directionAxisLabel,
  directionLabel,
  m,
  glyphLabel,
  polygonName,
  silhouetteLabel,
  taskLabel,
} from "../i18n.js";
import {
  DEFAULTS,
  DOT_SHAPES,
  ORDER_DIRECTION_AXES,
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
  type Direction,
  type DotMatrixOptions,
  type DotShape,
  type PresetName,
  type Silhouette,
} from "@botharness/botui-core";

const CARD = 44;

/**
 * The state the page opens on: a hand-picked look, not the engine's defaults.
 *
 * The engine's defaults are a library's choice and this page is allowed to disagree
 * with them — what it is demonstrating is a component someone would actually ship,
 * and shipped components are tuned. Every value here was picked to make one thing
 * legible at a glance:
 *
 * · **5×5 and no gap, at the largest size.** A field you can see the shape of. At 7×7
 *   with a 45% gap the dots are far enough apart that the motion reads as noise.
 * · **dot/cell 198%.** Over the cell, so the dots OVERLAP. This is the single number
 *   that makes it read as one surface rather than as separate pixels — and it is past
 *   the touching point, which is why the readout's own `dot / pitch` line is the one
 *   worth watching: 100% there means two dots touching.
 * · **grow 3%.** Almost no breathing. `grow` is how far a dot changes size over the
 *   cycle, and at 50% a small dot is a pulsing blob rather than a moving light.
 * · **stagger 70%, pinned.** A wide spread, and pinned rather than following the
 *   preset so the opening frame does not change under the visitor when they pick a
 *   different motion.
 * · **radius 0.** Square dots. The rounded corners are one control away, and a
 *   rounded dot at 198% overlap hides the grid the size is there to show.
 */
const SHOWCASE: Partial<DotMatrixOptions> = {
  size: 260,
  cols: 5,
  rows: 5,
  fill: 1,
  silhouette: "square",
  dot: "square",
  dotSize: 1.98,
  gapX: 0,
  gapY: 0,
  preset: "spiral",
  stagger: 0.7,
  softness: 0,
  grow: 0.03,
  floor: 0.16,
  speed: 1,
  spec: { ...GLYPH_DEFAULTS },
};

export function Playground({ initial }: { initial?: Partial<DotMatrixOptions> }) {
  const [options, setOptions] = useState<DotMatrixOptions>({ ...SHOWCASE, ...initial });
  // CSS by default, because it is the cheaper renderer and this is the one a product
  // page should be demonstrating: it costs zero JS per frame. SVG is the escape hatch
  // for the motions CSS cannot express, so it is the one you have to ask for.
  const [cssRenderer, setCssRenderer] = useState(true);

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
  // `?? DEFAULTS.preset` like every other read of the preset: `cssRenderable(undefined)`
  // is false, so without the default the switch claimed the engine refused a motion it
  // can express — and it was disabled on first paint for the default field.
  const cssAvailable = cssRenderable(options.preset ?? DEFAULTS.preset);
  // What the field will ACTUALLY be painted with. The toggle records a preference; the
  // preset can overrule it — `columns` cannot be expressed in CSS at all, and passing
  // `renderer="css"` anyway asked the engine for something it refuses, which left the
  // stage EMPTY rather than falling back. Disabling the switch without honouring it is
  // the worst of both: the control explains itself while the field shows nothing.
  const css = cssRenderer && cssAvailable;
  const sides = options.spec?.sides ?? GLYPH_DEFAULTS.sides;

  // the dot cards show ONE field so the only difference between them is the dot: a
  // shared 1×1 field makes "which dot?" answerable by comparison, and a per-card field
  // would hide a wrong dot behind an unusual arrangement
  const dotBase: DotMatrixOptions = { silhouette: "circle", size: CARD };

  // The axes the CURRENT traversal can vary, from the engine's own table. Asking here
  // rather than rendering all four and hiding some is what keeps the control honest: the
  // list of axes and the list of cards can never disagree.
  //
  // `PRESETS.off` is null — no motion, no traversal, and therefore no axis to vary — so
  // the group disappears entirely on `off` rather than offering directions for a field
  // that is not moving.
  const order = PRESETS[options.preset ?? DEFAULTS.preset]?.order;
  const directionAxes = order ? ORDER_DIRECTION_AXES[order] : [];

  return (
    <div className="playground">
      <div className="playground-main">
        {/* The stage carries its own controls. Rows, columns and dot size are the three
            things you reach for while looking AT the field — how many dots there are and
            how fat they look — so putting them beside the field means the eye never has
            to leave it. The field is what they change; that is the whole argument. */}
        <div className="playground-stage">
          <div className="stage-controls">
            <Stepper
              label={m.ctl_cols()}
              value={options.cols ?? 7}
              min={1}
              max={16}
              onChange={(cols) => set({ cols })}
            />
            <Stepper
              label={m.ctl_rows()}
              value={options.rows ?? 7}
              min={1}
              max={16}
              onChange={(rows) => set({ rows })}
            />
            {/* dot/cell leads the size group because it is the ratio that decides whether
                a field reads as dots, as pixels, or as a solid block. Overall size only
                changes how much room it takes. */}
            {/* NOT a PercentSlider: dot/cell is measured in hundredths-of-a-cell and
                legitimately exceeds 100 (above 1 the dots touch, which is the point of
                the range). PercentSlider means "a fraction of 1" and clamps to it, so a
                dot/cell of 200 arrived as 100 — the same raw-fraction-against-a-
                hundredths-track defect the other three sliders had. */}
            <Slider
              label={m.ctl_dot_cell()}
              value={Math.round((options.dotSize ?? 0.55) * 100)}
              min={5}
              max={200}
              step={1}
              display={`${Math.round((options.dotSize ?? 0.55) * 100)}%`}
              compact
              onChange={(v) => set({ dotSize: v / 100 })}
            />
            <label className="stage-toggle" title={`${m.css_renderer_note()} ${m.css_refused()}`}>
              <input
                type="checkbox"
                checked={cssRenderer}
                disabled={!cssAvailable}
                onChange={(e) => setCssRenderer(e.target.checked)}
                aria-label={m.css_renderer()}
              />
              <span className="stage-toggle-track" aria-hidden="true">
                <span className="stage-toggle-knob" />
              </span>
              <span className="stage-toggle-label">
                {m.css_renderer()}
                {!cssAvailable && <em>{m.css_refused()}</em>}
              </span>
            </label>
          </div>
          <Matrix
            {...options}
            renderer={css ? "css" : "svg"}
            key={`${options.preset ?? DEFAULTS.preset}-${options.silhouette}-${options.cols}x${options.rows}-${options.dot}`}
          />
          {/* The way out, under the field rather than in the sidebar: you tuned this THING,
              and the button that takes it away belongs to the thing. Spans both columns —
              it is a full-width primary action, not another sidebar control, and a control
              that reads as primary should look like one rather than like a ghost button. */}
          <ShowcaseCopy tuning={{ options, css }} />
        </div>

        {/* Shape, as pictures. Two groups because the engine has two shapes: the field's
            outline and the dot inside it. A single slider list called them both "shape"
            and left the reader to guess which was which. */}
        <CardGroup
          label={m.group_shape()}
          scope={m.scope_field_shape()}
          value={options.silhouette ?? DEFAULTS.silhouette}
          onChange={(silhouette) => set({ silhouette: silhouette as Silhouette })}
          options={SILHOUETTE_KEYS.map((key) => ({ value: key, label: silhouetteLabel(key) }))}
          renderPreview={(value) => <SilhouetteCard value={value as Silhouette} size={CARD} />}
        />

        <CardGroup
          label={m.group_motion()}
          scope={m.scope_motion()}
          value={options.preset ?? DEFAULTS.preset}
          onChange={(preset) => set({ preset: preset as PresetName })}
          options={PRESET_KEYS.map((key) => ({ value: key, label: taskLabel(key) }))}
          renderPreview={(value) => (
            <LiveCard
              options={{
                cols: 5,
                rows: 5,
                silhouette: "square",
                dot: "circle",
                size: 56,
                preset: value as PresetName,
              }}
              size={56}
            />
          )}
        />

        {/* DIRECTION, and it is per-motion rather than global: which ways exist depends
            on the traversal, so `clockwise` is offered on a spiral and withheld from a
            concentric ring — a ring is a distance and has no winding, and offering the
            choice would be a control claiming something the engine does not have.

            One card group PER AXIS, because the axes are independent. A row-major snake
            has two, and its four corners are four different drawings: a single
            left/right toggle could only ever reach two of them. */}
        {directionAxes.map((a) => (
          <CardGroup
            key={a.axis}
            label={m.dir_group()}
            // the axis name IS the scope: it says what this group changes, which is what
            // the other groups' scopes do. Sharing one scope string across the direction
            // groups would make them indistinguishable by text alone.
            scope={directionAxisLabel(a.axis)}
            // The axis's FORWARD end stands selected when no token is set, because forward
            // is the motion's own direction. A third "auto" card would be a fifth card
            // drawn identically to `forward`, and a radio group with nothing checked would
            // break the one-selection-per-group contract every other card group keeps.
            value={
              (options.direction ?? []).find((d) => d === a.forward || d === a.backward) ??
              a.forward
            }
            onChange={(chosen) =>
              set({
                // replace THIS axis and keep the others: two axes are live at once, so
                // toggling one must not clear the other
                direction: toggleDirection(options.direction, a, chosen as Direction | undefined),
              })
            }
            options={[
              { value: a.forward, label: directionLabel(a.forward) },
              { value: a.backward, label: directionLabel(a.backward) },
            ]}
            renderPreview={(value) => (
              <Still
                // the engine's OWN frame at this direction — a card that drew an arrow or a
                // spiral glyph would be an illustration of the motion rather than the motion
                options={{
                  cols: 5,
                  rows: 5,
                  silhouette: "square",
                  dot: "circle",
                  size: 56,
                  preset: options.preset ?? DEFAULTS.preset,
                  direction: toggleDirection(options.direction, a, value as Direction),
                }}
                size={56}
                phase={0.12}
              />
            )}
          />
        ))}

        <CardGroup
          label={m.group_dot()}
          scope={m.scope_dot_shape()}
          value={options.dot ?? DEFAULTS.dot}
          onChange={(dot) =>
            set({
              dot: dot as DotShape,
              spec: { ...DOT_SHAPES[dot as keyof typeof DOT_SHAPES].spec },
            })
          }
          options={DOT_SHAPE_KEYS.map((key) => ({ value: key, label: glyphLabel(key) }))}
          renderPreview={(value) => (
            <Still
              options={{
                ...dotBase,
                cols: 1,
                rows: 1,
                dot: value as DotShape,
                spec: { ...DOT_SHAPES[value as keyof typeof DOT_SHAPES].spec },
                dotSize: 1.4,
                gapX: 0,
                gapY: 0,
              }}
              size={CARD}
              phase={0}
            />
          )}
        />
      </div>

      <div className="playground-side">
        {/* Motion, as pictures too. A preset's name is the least informative thing about
            it: `spiral` and `ring` differ in a way no label conveys, and a still frame
            only half-conveys it. These run the engine, and only once you reach them —
            twelve fields animating at once is a page that melts the laptop it is trying
            to sell a component for. */}
        <Group label={m.group_timing()}>
          {/* speed and stagger stay sliders: both are continuous, and a still frame
              cannot show a rate at all — the label is the honest representation */}
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
              back to following the preset. */}
          <PercentSlider
            label={m.ctl_stagger()}
            fraction={options.stagger ?? presetSpread(options.preset)}
            max={200}
            display={
              options.stagger == null
                ? m.value_preset({
                    value: percentOf(options.stagger ?? presetSpread(options.preset)),
                  })
                : percentOf(options.stagger)
            }
            dirty={options.stagger != null}
            onReset={() => set({ stagger: null })}
            onChange={(stagger) => set({ stagger })}
          />
        </Group>

        {/* The envelope, its breath and its floor, ahead of the geometric detail.
            They change what a field FEELS like rather than how big it is, and they
            were the three the page was reported as having "no way to adjust" — a 20px
            overflow in an 813px viewport put them below the fold, under a side column
            nobody could see the bottom of. */}
        <Group label={m.group_envelope()}>
          <PercentSlider
            label={m.ctl_softness()}
            fraction={options.softness ?? 0}
            display={`${Math.round((options.softness ?? 0) * 100)}%`}
            onChange={(v) => set({ softness: v })}
          />
          <PercentSlider
            label={m.ctl_grow()}
            fraction={options.grow ?? 0.5}
            display={percent(options.grow ?? 0.5)}
            onChange={(v) => set({ grow: v })}
          />
          <PercentSlider
            label={m.ctl_floor()}
            fraction={options.floor ?? 0.16}
            display={percent(options.floor ?? 0.16)}
            onChange={(v) => set({ floor: v })}
          />
        </Group>

        <Group label={m.group_geometry()}>
          {/* the polygon is a slider because it is a NUMBER: the cards show named glyphs,
              and `sides` is what reaches the ones with no name — a 7-gon, a 9-gon */}
          <Slider
            label={m.ctl_sides()}
            value={sides}
            min={3}
            max={10}
            step={1}
            display={polygonName(sides)}
            onChange={(n) => setSpec({ sides: n })}
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
          {/* overall size LAST in the geometry column: it decides how much room the field
              takes, not what it looks like, and it is the setting least likely to be the
              reason someone opened the page */}
          <Slider
            label={m.ctl_size()}
            value={options.size ?? DEFAULTS.size}
            min={24}
            max={260}
            step={1}
            display={`${options.size ?? DEFAULTS.size}px`}
            onChange={(size) => set({ size })}
          />
          <PercentSlider
            label={m.ctl_gap_x()}
            fraction={options.gapX ?? 0}
            step={5}
            max={200}
            display={percent(options.gapX ?? 0)}
            onChange={(v) => set({ gapX: v })}
          />
          <PercentSlider
            label={m.ctl_gap_y()}
            fraction={options.gapY ?? 0}
            step={5}
            max={200}
            display={percent(options.gapY ?? 0)}
            onChange={(v) => set({ gapY: v })}
          />
        </Group>

        <pre className="playground-readout">
          {[
            `${m.readout_dot_cell()}   ${Math.round((options.dotSize ?? 0) * 100)}%`,
            `${m.readout_dot_pitch()}  ${Math.round(pitchShare * 100)}%    ${m.readout_touching_hint()}`,
            `${m.readout_touching()}  ${m.readout_touching_value({ value: touching.toFixed(2) })}`,
            `${m.readout_pitch()}        ${geometry.pitchX.toFixed(1)} × ${geometry.pitchY.toFixed(1)} px`,
            `${m.readout_dot()}          ${geometry.dotPx.toFixed(1)} px`,
            `${m.readout_silhouette()}   ${silhouetteLabel(options.silhouette ?? DEFAULTS.silhouette)}   dot ${polygonName(sides)}`,
            `${m.readout_renderer()}     ${css ? "css" : "svg"}   ${m.readout_speed()} ${m.value_speed({ value: (options.speed ?? 1).toFixed(2) })}`,
          ].join("\n")}
        </pre>
      </div>
    </div>
  );
}

/**
 * Set or clear ONE axis's token, leaving the other axes alone.
 *
 * Two axes are live at once on a spiral and on a snake, so the obvious implementation —
 * `direction: chosen ? [chosen] : []` — would silently clear the winding every time the
 * radius moved.
 *
 * Choosing an axis's FORWARD end clears its token rather than writing one: forward is the
 * motion's own direction, so `direction: ["clockwise"]` would state what the engine does
 * anyway, and the snippet emits a token only when something was overridden.
 */
function toggleDirection(
  current: Direction[] | undefined,
  axis: { forward: Direction; backward: Direction },
  chosen: Direction | undefined,
): Direction[] {
  const rest = (current ?? []).filter((d) => d !== axis.forward && d !== axis.backward);
  if (!chosen || chosen === axis.forward) return rest;
  return [...rest, chosen];
}

const percent = (v: number) => percentOf(v);
const percentOf = (v: number) => `${Math.round(v * 100)}%`;

/**
 * A preset's own stagger, or 0 when it has none.
 *
 * `PRESETS.off` is `null` — "no motion" has no spread to spread — so reading
 * `PRESETS[preset].spread` on the `off` card threw a TypeError, the render threw, and the
 * card group stopped updating. Reported as "some motions will not switch however many times
 * you click"; the click was landing and the page was dying on it. `breathe` also has spread
 * 0, but it is a real preset object, so it was never the failure.
 */
function presetSpread(preset: PresetName | undefined): number {
  return PRESETS[preset ?? DEFAULTS.preset]?.spread ?? 0;
}

/** the radius at which this polygon's corners are fully rounded — a true circle */
function inradiusOf(sides: number): number {
  return glyphPath({ sides }).inradius;
}

/**
 * Rows and columns as buttons rather than a range input.
 *
 * A range input's thumb has to be hunted for and dragged to hit a target, and for a
 * small integer that is strictly worse than two buttons: you want "one more" and "one
 * fewer", which is what the buttons do. It is also keyboard-operable without hunting,
 * which a slider is not at `step={1}` over sixteen steps.
 *
 * The value is clamped here as well as in the engine, because a disabled button that
 * still fires its handler is a control that lies about its own bounds.
 */
function Stepper({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  const dec = () => onChange(Math.max(min, value - 1));
  const inc = () => onChange(Math.min(max, value + 1));
  return (
    <div className="stepper">
      <span className="stepper-label">{label}</span>
      <div className="stepper-controls">
        <button type="button" onClick={dec} disabled={value <= min} aria-label={`${label} −`}>
          −
        </button>
        <output aria-label={label}>{value}</output>
        <button type="button" onClick={inc} disabled={value >= max} aria-label={`${label} +`}>
          +
        </button>
      </div>
    </div>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <fieldset className="playground-group">
      <legend>{label}</legend>
      {children}
    </fieldset>
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
  compact,
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
  /** laid out for the stage overlay: label beside the track, not above it */
  compact?: boolean;
  onReset?: () => void;
  onChange: (fraction: number) => void;
}) {
  return (
    <Slider
      label={label}
      // The track is in HUNDREDTHS of the option, always: `onChange` divides by 100, so
      // track 100 is fraction 1 and track `max` is fraction `max / 100`. The clamp was
      // `Math.min(fraction, 1) * 100`, which pinned every slider at track 100 — so speed
      // (max 300), stagger, gap x and gap y each had a top half of their travel that did
      // nothing, and the thumb sat in the middle of a track it could never reach the end
      // of. Clamp against the track's own top instead.
      value={Math.round(Math.min(Math.max(fraction * 100, min), max))}
      min={min}
      max={max}
      step={step}
      display={display ?? percent(fraction)}
      dirty={dirty}
      compact={compact}
      onReset={onReset}
      onChange={(v) => onChange(v / 100)}
    />
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  display,
  dirty,
  compact,
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
  compact?: boolean;
  onReset?: () => void;
  onChange: (value: number) => void;
}) {
  return (
    <label className="playground-field" data-compact={compact || undefined}>
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
              {dirty ? "↺" : "·"}
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
