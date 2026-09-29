"use client";

import {
  createDotMatrix,
  presetForState,
  resolveOptions,
  type AgentState,
  type DotMatrixHandle,
  type DotMatrixOptions,
  type PresetName,
} from "@botharness/botui-core";
import {
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  type CSSProperties,
  type ForwardedRef,
} from "react";

export interface DotMatrixProps extends DotMatrixOptions {
  /**
   * The agent state to express. This is the vocabulary an agent UI already speaks,
   * and it maps to a motion for you — `state="thinking"` is `preset="spiral"`. An
   * explicit `preset` wins, so a component can be state-driven by default and
   * overridden at the call site.
   */
  state?: AgentState;
  /** the motion, by name. Wins over `state`. */
  preset?: PresetName;
  /** run the clock. false renders one representative frame. */
  playing?: boolean;
  /** seek to an exact phase, in seconds. Rendering stops while this is a number. */
  at?: number;
  /** your ref to the underlying handle — start/stop/seek/set */
  ref?: ForwardedRef<DotMatrixHandle | null>;
  className?: string;
  style?: CSSProperties;
  /** announced to assistive tech, since the field itself is decorative */
  label?: string;
}

/**
 * `<DotMatrix />` — a loading field as a React component.
 *
 * The component is a thin shell: it owns a ref, a lifecycle and a props→options
 * translation, and every pixel comes from `createDotMatrix`. Keeping it thin is the
 * point — a wrapper that re-implemented the field would be a second renderer to keep
 * in step with the first.
 *
 * The element is `aria-hidden` and carries a visually-hidden label, because a
 * loading field is decorative: the accessible name belongs to whatever is loading.
 */
export function DotMatrix({
  state,
  preset,
  playing = true,
  at,
  className,
  style,
  label = "Loading",
  ref,
  ...options
}: DotMatrixProps) {
  const host = useRef<HTMLDivElement>(null);
  const handle = useRef<DotMatrixHandle | null>(null);

  // `state` is a shorthand for a preset, resolved once per render. `preset` wins, so
  // a caller can pin a motion and still pass a state for semantics.
  const resolvedPreset = useMemo<PresetName>(
    () => preset ?? presetForState(state),
    [preset, state],
  );

  // The options the engine gets, as a plain object recomputed each render. They are
  // NOT a useMemo dependency: the object is new every render by construction, and a
  // serialised key (JSON.stringify) would be both wasteful and wrong — it drops
  // undefined, reorders nothing, and silently treats two different functions as one
  // value. Instead the effect below runs every render and pushes the change through
  // `set`, which patches the live options without touching the clock.
  const engineOptions = resolveOptions({ ...options, preset: resolvedPreset });

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const dm = createDotMatrix(element, engineOptions);
    handle.current = dm;
    if (playing) dm.start();
    else dm.stop();
    return () => {
      dm.destroy();
      handle.current = null;
    };
    // mounted once: later changes go through set(), so the clock is never
    // interrupted and the animation never restarts because a parent re-rendered
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // options, without disturbing the clock. Deliberately unfiltered: `set` is a
  // no-op when nothing changed, and an effect with a dependency array over an object
  // that is new every render would run on every render anyway — while hiding the
  // fact that this is the only thing keeping the two in step.
  const lastOptions = useRef<object | null>(null);
  useEffect(() => {
    if (lastOptions.current && shallowEqual(lastOptions.current, engineOptions)) return;
    lastOptions.current = engineOptions;
    handle.current?.set(engineOptions);
  });

  useEffect(() => {
    const dm = handle.current;
    if (!dm) return;
    if (typeof at === "number") {
      dm.stop();
      dm.t = at;
    } else if (playing) {
      dm.start();
    } else {
      dm.stop();
    }
  }, [playing, at]);

  // the handle is only meaningful after mount, so the ref resolves to null before
  // then rather than throwing inside a ref callback
  useImperativeHandle<DotMatrixHandle | null, DotMatrixHandle | null>(
    ref,
    () => handle.current,
    [],
  );

  return (
    <div
      ref={host}
      className={className}
      style={style}
      role="img"
      aria-label={label}
      data-preset={resolvedPreset}
      {...(state ? { "data-state": state } : {})}
    />
  );
}

/** shallow, one level deep — enough for the flat option bag, and cheap */
function shallowEqual(a: object, b: object): boolean {
  const left = a as Record<string, unknown>;
  const right = b as Record<string, unknown>;
  const keys = Object.keys(left);
  if (keys.length !== Object.keys(right).length) return false;
  return keys.every((k) => (left[k] === right[k] ? true : sameSpec(left[k], right[k])));
}

function sameSpec(a: unknown, b: unknown): boolean {
  if (typeof a !== "object" || typeof b !== "object" || !a || !b) return a === b;
  const left = a as Record<string, unknown>;
  const right = b as Record<string, unknown>;
  const keys = Object.keys(left);
  return keys.length === Object.keys(right).length && keys.every((k) => left[k] === right[k]);
}

export type {
  AgentState,
  DotMatrixHandle,
  DotMatrixOptions,
  PresetName,
} from "@botharness/botui-core";
export {
  DOT_SHAPES,
  PRESETS,
  STATE_PRESETS,
  dotShareOfPitch,
  layout,
  touchingDotSize,
} from "@botharness/botui-core";
