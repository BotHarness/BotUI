import { useCallback, useMemo, useRef, useState } from "react";
import { Matrix } from "./Matrix.js";
import { m } from "../i18n.js";
import { layout } from "@botharness/botui-core";
import { cellCentre, chevron, nearestCell, ringsFrom } from "../traversals.js";
// The source of the traversals file, at build time. Shown beside the field so the code a
// visitor reads IS the code that is running — a hand-kept copy of a function is a copy that
// lies the first time anyone edits one of them.
import traversalSource from "../traversals.ts?raw";

// The file, from the first export onward. The header comment explains WHY these exist, which
// is for us; a visitor's first question is what to copy, and scrolling past five paragraphs
// of rationale to reach it is the wrong first impression of a code sample.
const COPYABLE = traversalSource.slice(traversalSource.indexOf("export"));

const N = 9;

/**
 * The field's geometry, from the ENGINE.
 *
 * The same numbers `<Matrix>` lays out with, so the handle can be placed on a cell and the
 * hit-test can be taken against it with no approximation in between. This is the library's
 * own rule — `field()` is the only place geometry is computed — applied to a control that
 * has to agree with the thing it is pointing at.
 */
const FIELD = {
  cols: N,
  rows: N,
  silhouette: "square",
  dot: "circle",
  dotSize: 0.8,
  gapX: 0.12,
  gapY: 0.12,
  size: 260,
} as const;
const GEO = layout(FIELD);

/**
 * The `order` seam, on the page.
 *
 * A capability the page cannot demonstrate is a capability that quietly stops working, and
 * this one has a specific hazard: `order` is a FUNCTION, so it cannot go in the copied
 * snippet. A visitor who reproduced the settings from the copy button would get the preset's
 * motion and no indication why. So this demo is deliberately separate from the playground —
 * its own field, its own settings, its own copy button that copies the CODE — and the code is
 * right there to paste.
 *
 * Two traversals, because they answer two different questions:
 *
 *   chevron   the SHAPE of the traversal can be anything you can compute per cell, including
 *             an easing along its own axis — which is what "accelerating" actually is.
 *   rings     the ORIGIN can be anywhere, which the library's concentric preset pins to the
 *             middle. Click the field to move it.
 */
export function TraversalDemo() {
  const [variant, setVariant] = useState<"chevron" | "rings">("chevron");
  const [origin, setOrigin] = useState({ col: 4, row: 4 });

  // rebuilt whenever the origin moves, and the field below is keyed on it so the engine
  // re-ranks rather than remounting — the same path a real caller takes
  // the handle's position, from the same geometry the hit-test uses
  const at = cellCentre(GEO, origin);

  const order = useMemo(
    () => (variant === "chevron" ? chevron : ringsFrom(origin)),
    [variant, origin],
  );

  /**
   * A pointer position, as a cell.
   *
   * Measured from the field's CENTRE and divided by the engine's pitch — the identity, not
   * an approximation. An earlier version used `box.width / cols` as the pitch and scaled by
   * the half-width a second time, which made the control four times too sensitive: at the
   * rim of a 9-wide field that is a twelve-cell error, so the handle saturated at the edge
   * while the cursor was halfway out and dragging further did nothing.
   */
  const move = useCallback((e: { clientX: number; clientY: number }) => {
    const host = hostRef.current?.getBoundingClientRect();
    if (!host) return;
    setOrigin(
      nearestCell(
        { x: e.clientX - host.left - host.width / 2, y: e.clientY - host.top - host.height / 2 },
        GEO,
        N,
        N,
      ),
    );
  }, []);

  const hostRef = useRef<HTMLDivElement>(null);

  return (
    <div className="traversal-demo">
      <div className="traversal-demo-head">
        <div className="traversal-choices" role="group" aria-label={m.demo_traversal_which()}>
          <button
            type="button"
            className={variant === "chevron" ? "is-on" : undefined}
            aria-pressed={variant === "chevron"}
            onClick={() => setVariant("chevron")}
          >
            {m.demo_traversal_chevron()}
          </button>
          <button
            type="button"
            className={variant === "rings" ? "is-on" : undefined}
            aria-pressed={variant === "rings"}
            onClick={() => setVariant("rings")}
          >
            {m.demo_traversal_rings()}
          </button>
        </div>
        {variant === "rings" && <p className="traversal-hint">{m.demo_traversal_click()}</p>}
      </div>

      <div className="traversal-demo-body">
        <div
          className="traversal-field"
          // DRAG, not click. A centre you can only reach by clicking a single pixel is a
          // target nobody aims at twice, and the arrow demo asked for a centre precisely so
          // it could be swept — so a pointer-down commits it and every move while held
          // updates it. `touch-action: none` in the CSS, or a touch drag scrolls the page
          // instead of moving the centre.
          onPointerDown={(e) => {
            if (variant !== "rings") return;
            e.currentTarget.setPointerCapture(e.pointerId);
            move(e);
          }}
          onPointerMove={(e) => {
            // only while held: a hover would make the centre chase the cursor across the
            // field the moment it entered, which is not a thing anybody asked for
            if (variant === "rings" && e.buttons) move(e);
          }}
        >
          {/* The wrapper is sized by the field, so the overlay inside it lines up with the
              host EXACTLY. Positioning the handle in percentages of the padded box put it
              up to 16px from the cell it claimed to be on — right for the middle, wrong at
              every edge. */}
          <div className="traversal-stage" ref={hostRef}>
            <Matrix
              {...FIELD}
              preset={variant === "chevron" ? "spiral" : "ripple"}
              renderer="css"
              order={order}
            />
            {variant === "rings" && (
              // The handle, drawn rather than described: a ring with a filled centre,
              // because a 7px dot on a field of 81 dots reads as one more dot. The ring is
              // what says "this is a thing you move".
              <span className="traversal-origin" aria-hidden="true">
                <span style={{ left: at.x, top: at.y }} />
              </span>
            )}
          </div>
        </div>

        <div className="traversal-code">
          {/* No caption here: the section's lede already says what these are, and a second
              copy of the same sentence one inch away is the thing people stop reading. */}
          <pre>
            <code>{COPYABLE}</code>
          </pre>
        </div>
      </div>
    </div>
  );
}
