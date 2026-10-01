/**
 * The public vocabulary. Everything a caller can name lives here, so the option
 * names, the layer tables and the handle are all discoverable from one file.
 */

/** A polygon dot: `sides` vertices, two corner radii, an optional star ratio. */
export interface DotGlyphSpec {
  /** vertex count; 3 is a triangle, 4 a square, 5 a pentagon, 6 a hexagon */
  sides: number;
  /** outer fillet, in the same units as the polygon: 0 = hard corners, up to the inradius = a circle */
  radius: number;
  /** fillet on the reflex corners — the notches of a star. 0.5 turns the points into teardrops. */
  innerRadius: number;
  /** 0 = plain n-gon, ~0.45 = a classic 5-point star */
  star: number;
  /** rotation in radians, for the upright 5-point star */
  spin: number;
  /** x/y stretch: 1 is square, 0.55 a wide ellipse, 0.3 a bar */
  aspect: number;
}

/** A kept lattice cell, on normalised coordinates so a silhouette reads the same at any size. */
export interface LatticeCell {
  col: number;
  row: number;
  /** -1…1 across the field */
  nx: number;
  /** -1…1 down the field */
  ny: number;
}

/** A [position, brightness] pair. */
export type EnvelopeStop = readonly [position: number, brightness: number];

/** The brightness of one cell over one cycle. */
export interface Envelope {
  /** [position, brightness] stops, interpolated piecewise-linearly. MUST start and end at `rest`. */
  stops: readonly EnvelopeStop[];
  /** the level outside the band */
  rest: number;
  /** the width of the lit band; past it the cell sits at `rest` */
  duty?: number | null;
  /** a travelling gaussian instead of a stop table — the moving-highlight arm */
  gauss?: number;
  /** render as N discrete shelves across the band instead of a gradient */
  /** the CSS cycle length; the runtime divides it by `speed` */
  cycleMs?: number;
}

/**
 * One end of one traversal axis — "left to right", "clockwise", "outside in".
 *
 * This is a property of the TRAVERSAL, not of the envelope, so it is one option for every
 * motion rather than a dozen presets: `counterClockwise` composes with `spiral` the same
 * way `grow` composes with a preset it did not choose.
 *
 * The vocabulary is deliberately NOT a single "reverse" flag. A row-major snake has two
 * INDEPENDENT axes — which end of the first row leads, and whether the rows run top to
 * bottom or bottom to top — and collapsing them into one flag makes the fourth corner
 * unreachable. That is why `direction` is a list: `["rightToLeft", "bottomToTop"]` is a
 * real motion and no single token could name it.
 *
 * It is also deliberately not the same set everywhere. `clockwise` is meaningless on a
 * concentric ring, because a ring is a distance and has no winding. ORDER_DIRECTION_AXES
 * says which axes each order has, so a control can offer only real choices.
 *
 * The names are relative to the motion, not to the screen: for a COLUMN-major snake,
 * `bottomToTop` is the axis it travels along, and for a row-major snake it is the axis it
 * is series-ordered in. Both are true, which is why each order reads the tokens itself.
 */
export type Direction =
  | "leftToRight"
  | "rightToLeft"
  | "topToBottom"
  | "bottomToTop"
  | "clockwise"
  | "counterClockwise"
  | "outsideIn"
  | "insideOut";

/**
 * A traversal: 0 leads, 1 trails. Defined on the ACTUAL cols×rows lattice, never a square.
 *
 * `dir` is optional and defaults to the order's own behaviour, so every existing call —
 * and every existing four-argument order function written by a consumer — keeps working.
 */
export type OrderFn = (
  col: number,
  row: number,
  cols: number,
  rows: number,
  dir?: readonly Direction[],
) => number;

/** A cell mask over the lattice. */
export type SilhouetteFn = (nx: number, ny: number) => boolean;

/** A named motion: a traversal plus an envelope, and what the agent state is called. */
export interface Preset {
  order: Order;
  env: EnvelopeName;
  /** how far the traversal spreads across the cycle; `stagger` overrides it */
  spread: number;
  /** whether the CSS renderer can express this motion at all */
  css: boolean;
  /** the agent state this motion is meant to express — the key is the motion, the label is the job */
  task: string;
  /** the envelope fills its band, so a fat dot reads as a morphing mass, not a bead */
  solid?: boolean;
}

/**
 * The layer vocabularies, spelled out as literal unions rather than derived from
 * the tables with `keyof typeof`.
 *
 * Deriving them would make types.ts import the very tables that import it, so every
 * table's type would be computed from itself — TS gives up and silently falls back
 * to `any` at the first self-reference. Written out, the unions are the contract,
 * and each table is declared as an exhaustive `Record` of one, so adding an order
 * or an envelope without adding it here fails the build.
 */
export type Silhouette = "square" | "circle" | "diamond" | "hex" | "ring" | "cross";

/** Which traversal the light follows. */
export type Order =
  | "spiral"
  | "snake"
  | "columnSnake"
  | "diagonal"
  | "ring"
  | "radial"
  | "center"
  | "row"
  | "column";

/** The brightness shapes a preset can name. */
export type EnvelopeName = "comet" | "wave" | "breathe" | "plateau" | "chase" | "spike";

/** The named glyphs in DOT_SHAPES, plus 'custom' to drive the polygon directly. */
export type DotShape =
  | "square"
  | "rounded"
  | "circle"
  | "ellipse"
  | "triangle"
  | "diamond"
  | "pentagon"
  | "hexagon"
  | "star4"
  | "star5"
  | "star6"
  | "burst"
  | "drop"
  | "bar"
  | "custom";

/** A named motion, or 'off'. */
export type PresetName =
  | "spiral"
  | "snake"
  | "columnSnake"
  | "ripple"
  | "ring"
  | "diagonal"
  | "columns"
  | "breathe"
  | "morph"
  | "off";

/** The agent states this component covers, each mapped to a motion. */
export type AgentState = "thinking" | "working" | "searching" | "streaming" | "waiting" | "error";

export interface DotMatrixOptions {
  /**
   * The component's box, in px — the only length in the public vocabulary.
   * Everything else is a fraction of it, so a field at 16 and the same field at
   * 240 are the same drawing at two scales.
   */
  size?: number;
  cols?: number;
  rows?: number;
  /** share of the box the field's centre span takes (1 = fills it) */
  fill?: number;
  silhouette?: Silhouette;
  dot?: DotShape;
  /**
   * The dot's footprint as a FRACTION OF ITS CELL. Above 1 the dot is wider than
   * its cell, so neighbours touch and the field reads as one continuous mass. The
   * field still lands exactly on the box at any value, because this is solved
   * for rather than clipped.
   */
  dotSize?: number;
  /**
   * The space BETWEEN cells, as a multiple of the cell, per axis independently.
   * Two dots touch when the dot is one PITCH wide, and the pitch is the cell
   * times (1 + gap) — so the touching point is at `1 + gap`, not at 1.
   */
  gapX?: number;
  gapY?: number;
  preset?: PresetName;
  /**
   * YOUR OWN TRAVERSAL, replacing the preset's. This is the seam the whole layered design
   * leaves open: which dot leads, and in what order, is one function of the lattice
   * position, so anything you can compute per cell you can animate.
   *
   * ```ts
   * // a chevron that speeds up toward its tip: the traversal value is eased, so
   * // successive dots along the V start closer together in phase
   * order: (col, row, cols, rows) => {
   *   const mid = (rows - 1) / 2;
   *   const across = Math.abs(row - mid) / (mid || 1);   // 0 at the spine, 1 at the tips
   *   const along = col / (cols - 1 || 1);
   *   const v = across * 0.5 + along * 0.5;                // down one arm, along the other
   *   return v * v;                                       // ease-in: faster toward the tip
   * }
   * ```
   *
   * The function is called once per cell per frame (SVG) or once per cell when the host is
   * built and again whenever it is re-ranked (CSS), so it should be cheap and pure.
   *
   * `dir` arrives as a FIFTH argument — see `OrderFn`. A four-argument function still works
   * and simply ignores it, which is the common case: a custom traversal that has no
   * direction of its own should not be forced to accept one.
   *
   * It is a FUNCTION, and that has one consequence worth stating: it cannot be serialised,
   * so the playground's copy-your-settings button leaves it out rather than pretending.
   * A component carrying a custom traversal is a component whose motion is code — keep the
   * copyable settings for what the library can express, and keep this in the source.
   */
  order?: OrderFn;
  /**
   * Which way the light travels, as one token per axis. OMITTED or empty is the motion's
   * own direction — every existing call means that, so this is backward compatible.
   */
  direction?: Direction[];
  /** the darkest a dot gets */
  floor?: number;
  /** the brightest a dot gets */
  peak?: number;
  /** cycles per second */
  speed?: number;
  /** 0 = fixed size (an LED panel), 1 = full breath */
  grow?: number;
  /**
   * How far apart in phase two neighbouring dots start, as a fraction of the
   * cycle. null = use the preset's own value; 0 collapses the stagger and the
   * field pulses as one, which is smooth but stops travelling.
   */
  stagger?: number | null;
  /**
   * How much longer the wave's own ramp is, which is what decides whether
   * neighbouring dots read as a gradient or as batches. 0 leaves the envelope
   * as authored. See the neighbour-step identity in the docs.
   */
  softness?: number;
  color?: string;
  /** the live polygon; a named `dot` seeds it, and it is then yours to drive */
  spec?: Partial<DotGlyphSpec>;
  /** which renderer paints it. 'svg' always works; 'css' hands the motion to the browser. */
  renderer?: "svg" | "css";
  /** respect prefers-reduced-motion by holding a static ramp instead of animating */
  reducedMotion?: boolean;
}

/**
 * A dot matrix with every option filled in.
 *
 * `order` is omitted from the `Required` for the same reason `stagger` is: absent means
 * "use the preset's own", which is not a value the resolver can fill in with anything —
 * there is no default traversal, because a default would be one more thing silently
 * overriding the caller. It stays `undefined` until a caller supplies one, and
 * `resolveField` is where the preset's traversal takes over.
 */
export type ResolvedDotMatrixOptions = Required<Omit<DotMatrixOptions, "stagger" | "order">> & {
  stagger: number | null;
  order?: OrderFn;
};

/** The geometry of a field, in px. Both renderers are driven from this. */
export interface DotMatrixLayout {
  /** the cell on the x axis */
  cellX: number;
  /** the cell on the y axis */
  cellY: number;
  gapX: number;
  gapY: number;
  /** centre-to-centre distance on the x axis */
  pitchX: number;
  /** centre-to-centre distance on the y axis */
  pitchY: number;
  /** the dot's width, taken from the tighter axis so it can never overlap on either */
  dotPx: number;
  size: number;
}

/** One dot, in px, ready for a renderer. Carries the glyph path so the two renderers cannot disagree. */
export interface DotRecord {
  x: number;
  y: number;
  /** half the dot's width in glyph units — the renderer scales by this */
  r: number;
  opacity: number;
  /** the traversal position, 0…1 */
  order: number;
  /** the envelope level, 0…1 */
  v: number;
  col: number;
  row: number;
  /** the glyph path, unit-scale around the origin */
  d: string;
}

/** A resolved glyph: its path plus the measurements the layout needs. */
export interface GlyphPath {
  /** the path data, unit-scale around the origin */
  d: string;
  /** the radius at which the corners are fully rounded */
  inradius: number;
  /** the bounding box the dot is SIZED against — not the inradius; see glyph.ts */
  box: number;
  pts: readonly (readonly [number, number])[];
}

export interface DotMatrixHandle {
  readonly element: HTMLElement;
  /** a copy of the resolved options, so a caller cannot mutate them behind the component's back */
  readonly options: ResolvedDotMatrixOptions;
  /** the clock, in seconds. Assign to seek. */
  t: number;
  set(patch: Partial<DotMatrixOptions>): void;
  start(): void;
  stop(): void;
  destroy(): void;
  /** why the CSS renderer cannot express the current preset, or null if it can */
  cssGap(): string | null;
  /** paint one frame at an explicit phase and return it — the field is a pure function of (options, t) */
  field(t?: number): DotRecord[];
}
