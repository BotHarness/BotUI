import { useEffect, useMemo, useRef } from "react";
import {
  createDotMatrix,
  field,
  resolveOptions,
  type DotMatrixHandle,
  type DotMatrixOptions,
} from "@botharness/botui-core";

export interface MatrixProps extends DotMatrixOptions {
  /** keep the component mounted but not animating — the state a paused demo is in */
  playing?: boolean;
  /** class on the wrapper, not on the field: the field sizes itself in px */
  className?: string;
}

/**
 * The engine, mounted from React.
 *
 * This is deliberately NOT the published `<DotMatrix>` wrapper. That one is a React
 * component in `packages/react`, and a docs site that demos its own component through
 * its own wrapper cannot show a bug in either — the site would inherit the fix and
 * report the component works. Here the only React code is a ref and an effect, so what
 * the page shows is `@botharness/botui-core` doing its own thing.
 */
export function Matrix({ playing = true, className, ...options }: MatrixProps) {
  const host = useRef<HTMLDivElement>(null);
  const handle = useRef<DotMatrixHandle | null>(null);
  // the live options, so the effect can push them without re-mounting the component
  const live = useRef<DotMatrixOptions>(options);
  live.current = options;

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    // mounted once: later option changes go through set(), so the clock is never
    // interrupted and the animation never restarts because a parent re-rendered
    const dm = createDotMatrix(element, live.current);
    handle.current = dm;
    return () => {
      dm.destroy();
      handle.current = null;
    };
  }, []);

  useEffect(() => {
    handle.current?.set(live.current);
  });

  useEffect(() => {
    const dm = handle.current;
    if (!dm) return;
    if (playing) dm.start();
    else dm.stop();
  }, [playing]);

  return <div ref={host} className={className} aria-hidden="true" />;
}

/**
 * A still frame of the engine, for the shape and preset cards.
 *
 * A card that draws its own approximation of a dot is a second implementation of the
 * thing it is advertising, and it drifts the moment the glyph code changes — which is
 * how a "pentagon" card ends up showing a pentagon the component no longer renders. So
 * this calls the engine's own `field()`, once, at a fixed phase, and emits the same
 * markup the live SVG renderer produces. There is no second drawing code here to fall
 * out of sync; the only decision this component makes is the phase to show.
 *
 * `phase` is not 0 on purpose. A traversal lives in the *difference* between cells, and
 * at t=0 most cells sit at the same level, so the card shows a uniform blob and says
 * nothing. A little way into the cycle the wavefront is visible, which is the thing the
 * card exists to show.
 */
export function Still({
  options,
  size,
  phase = 0.35,
  className,
}: {
  options: DotMatrixOptions;
  /** the card's edge length in px; the field is laid out against this, not scaled */
  size: number;
  phase?: number;
  className?: string;
}) {
  const markup = useMemo(() => {
    const o = resolveOptions(options);
    return field(o, phase)
      .map(
        (d) =>
          `<path d="${d.d}" transform="translate(${d.x.toFixed(2)} ${d.y.toFixed(2)}) scale(${d.r.toFixed(3)})"/>`,
      )
      .join("");
    // every option participates. A card that ignored `dot` would show a square while the
    // field below it shows a star — the exact confusion these cards exist to remove.
  }, [options, phase]);

  return (
    <svg
      className={className}
      viewBox={`${-size / 2} ${-size / 2} ${size} ${size}`}
      width={size}
      height={size}
      fill="currentColor"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  );
}

/**
 * A live, looping preview for the motion cards.
 *
 * The presets are the one control whose value cannot be read off a number: `spiral` and
 * `ring` differ in a way a label cannot convey and a still frame only half-conveys. So
 * these run the real engine rather than an animation of somebody's idea of it.
 *
 * Each card is paused unless it is hovered or focused, and none of them animate until
 * the pointer reaches them. Twelve simultaneously-running fields is a page that melts
 * the laptop it is trying to sell a component for; the trade is that the card you are
 * looking at is the one that moves.
 */
export function LiveCard({
  options,
  size,
  className,
}: {
  options: DotMatrixOptions;
  size: number;
  className?: string;
}) {
  // `pointer-events: none` is LOAD-BEARING, not cosmetic. These pointer handlers used to
  // sit on this div, which lives INSIDE the card's <label>. Moving the pointer onto a card
  // therefore started an animation, which re-rendered this subtree, and the re-render
  // interrupted the label's click: half the cards needed two or three clicks and some would
  // not switch at all. Measured with real mouse coordinates rather than synthetic clicks —
  // `element.click()` bypasses hit-testing entirely and reported every card as working.
  //
  // So nothing here receives pointer events at all. The play state is driven by CSS
  // instead: the animation runs while the card is hovered or has focus within, and the
  // element underneath is the one that gets the events.
  return (
    <div className={className}>
      <Matrix {...options} size={size} playing={true} />
    </div>
  );
}
