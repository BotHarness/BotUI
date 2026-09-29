import { useEffect, useRef } from "react";
import {
  createDotMatrix,
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
