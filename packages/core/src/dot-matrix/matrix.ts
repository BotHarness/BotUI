import type { DotMatrixHandle, DotMatrixOptions, DotRecord } from "../types.js";
import { resolveOptions } from "./layout.js";
import { applyCssVars, buildCss, buildSvg, field, resolveField } from "./field.js";
import { ensureStylesheet } from "./css.js";
import { cssRenderGap } from "./presets.js";

/** the frame a reduced-motion field rests on: representative, not the first one */
const REST_FRAME = 0.18;

/**
 * rAF, defensively.
 *
 * A browser always has it, but a DOM without it is ordinary: jsdom without
 * `pretendToBeVisual`, a Node test that only wants to check the markup. A component
 * that throws from `destroy()` there is a nuisance in someone else's test suite, and
 * the clock is the one thing a static field does not need.
 */
function scheduleFrame(cb: (ms: number) => void): number {
  return typeof requestAnimationFrame === "function" ? requestAnimationFrame(cb) : 0;
}

function cancelFrame(id: number): void {
  if (id && typeof cancelAnimationFrame === "function") cancelAnimationFrame(id);
}

/**
 * createDotMatrix(element, options) — mount a dot matrix.
 *
 * The component owns a clock and a renderer; the field itself is a pure function of
 * (options, t), so `handle.t` is seekable and `handle.field(t)` hands you a frame
 * without painting it.
 *
 * The two renderers are the same field: `field()` is the only place the geometry is
 * computed, and the SVG renderer paints exactly what it returns. A renderer that
 * re-derived the layout would drift from the other one, which is how the two ended
 * up disagreeing about pitch in the first place.
 */
export function createDotMatrix(
  element: HTMLElement,
  options: DotMatrixOptions = {},
): DotMatrixHandle {
  let live = resolveOptions(options);
  let t = 0;
  let raf = 0;
  let last = 0;
  let destroyed = false;

  const reduced = () => live.reducedMotion || prefersReducedMotion(element);
  /** the phase a given moment should be painted at, honouring reduced motion */
  const phase = (at: number) => (reduced() ? REST_FRAME : at);

  const paintSvg = () => {
    element.replaceChildren(buildSvg(live, phase(t)));
  };

  const paintCss = () => {
    const resolved = resolveField(live);
    if (!resolved) {
      element.replaceChildren();
      return;
    }
    // the keyframes are shared and depend on softness, so they are published when it
    // changes rather than per frame — rewriting them restarts every animation
    ensureStylesheet(element.ownerDocument, live.softness);
    let host = element.firstElementChild as HTMLElement | null;
    if (!host || !host.classList.contains("botui-dot-matrix")) {
      const built = buildCss(live);
      if (!built) return;
      element.replaceChildren(built);
      host = built;
    } else if (!applyCssVars(host, resolved)) {
      // The cells are not the ones these options call for — a different lattice or a
      // different silhouette. `applyCssVars` re-ranked what it could and said no; the
      // field is only correct once the cells themselves are rebuilt.
      const built = buildCss(live);
      if (!built) return;
      element.replaceChildren(built);
      host = built;
    }
    if (reduced()) host.dataset.reduced = "true";
    else delete host.dataset.reduced;
  };

  const paint = () => {
    if (live.renderer === "css") paintCss();
    else paintSvg();
  };

  const frame = (ms: number) => {
    if (destroyed) return;
    // clamped, so a backgrounded tab does not resume with a huge phase jump
    t += Math.min(0.05, (ms - (last || ms)) / 1000);
    last = ms;
    paint();
    raf = scheduleFrame(frame);
  };

  const handle: DotMatrixHandle = {
    element,
    get options() {
      return { ...live, spec: { ...live.spec } };
    },
    get t() {
      return t;
    },
    set t(v: number) {
      t = Number.isFinite(v) ? v : 0;
      paint();
    },
    set(patch) {
      const before = reduced();
      live = { ...live, ...patch, spec: { ...live.spec, ...patch.spec } };
      if (live.renderer === "css") ensureStylesheet(element.ownerDocument, live.softness);
      if (before !== reduced() && live.renderer === "svg") t = phase(t);
      paint();
    },
    /** the field at an explicit phase (or the current one), without painting it */
    field(at?: number): DotRecord[] {
      return field(live, phase(at ?? t));
    },
    start() {
      if (destroyed) return;
      if (reduced()) {
        // there is nothing to drive: the field already rests on a representative frame
        t = REST_FRAME;
        paint();
        return;
      }
      cancelFrame(raf);
      last = 0;
      raf = scheduleFrame(frame);
    },
    stop() {
      cancelFrame(raf);
      raf = 0;
    },
    destroy() {
      destroyed = true;
      cancelFrame(raf);
      raf = 0;
      element.replaceChildren();
    },
    cssGap() {
      return cssRenderGap(live.preset);
    },
  };

  paint();
  return handle;
}

function prefersReducedMotion(element: HTMLElement): boolean {
  const view = element.ownerDocument?.defaultView;
  return Boolean(view?.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);
}
