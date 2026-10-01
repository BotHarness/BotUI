import { useCallback, useMemo, useRef, useState } from "react";
import { Matrix } from "./Matrix.js";
import { m } from "../i18n.js";
import { chevron, nearestCell, ringsFrom } from "../traversals.js";
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
  const order = useMemo(
    () => (variant === "chevron" ? chevron : ringsFrom(origin)),
    [variant, origin],
  );

  /**
   * A pointer position, in lattice cells.
   *
   * The field is drawn from its centre outward in the engine's own px geometry, so the
   * click has to be measured from the middle rather than from the corner.
   */
  const move = useCallback((e: { clientX: number; clientY: number }) => {
    const box = fieldRef.current?.getBoundingClientRect();
    if (!box) return;
    const pitch = box.width / N;
    setOrigin(
      nearestCell(
        {
          x: e.clientX - box.left - box.width / 2,
          y: e.clientY - box.top - box.height / 2,
        },
        { x: pitch, y: pitch },
        N,
        N,
      ),
    );
  }, []);

  const fieldRef = useRef<HTMLDivElement>(null);

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
          ref={fieldRef}
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
          <Matrix
            cols={N}
            rows={N}
            size={260}
            silhouette="square"
            dot="circle"
            dotSize={0.8}
            gapX={0.12}
            gapY={0.12}
            preset={variant === "chevron" ? "spiral" : "ripple"}
            renderer="css"
            order={order}
          />
          {variant === "rings" && (
            // The handle, drawn rather than described: a ring with a filled centre, because
            // a 7px dot on a field of 81 dots reads as one more dot. The ring is what says
            // "this is a thing you move".
            <span className="traversal-origin" aria-hidden="true">
              <span
                style={{
                  left: `${(origin.col / (N - 1)) * 100}%`,
                  top: `${(origin.row / (N - 1)) * 100}%`,
                }}
              />
            </span>
          )}
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
