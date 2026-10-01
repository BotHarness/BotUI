import { useEffect, useRef, useState } from "react";
import { m, notationLabel } from "../i18n.js";
import { format, isHex, parseColor, resolveComputed, toHex, type Notation } from "../color.js";

const NOTATIONS: Notation[] = ["hex", "rgb", "hsl"];

/**
 * The dot colour.
 *
 * THREE THINGS THIS GETS RIGHT, and all three were decided by what the colour actually is
 * rather than by what a colour picker usually looks like.
 *
 * 1. THE NOTATION CHIPS DO NOT REWRITE THE COLOUR. hsl is quantised — `#2f5bff` is
 *    `hsl(227 100% 59%)`, and that spelled back out is `#2d5bff` — so a chip that rewrote
 *    the value would shift the swatch by a couple of 255ths every time it was clicked, and
 *    twice would be a visibly different colour. The chips are a VIEW; the canonical value
 *    only changes when somebody edits it.
 *
 * 2. THE SWATCH OPENS ON THE COLOUR THE PAGE ALREADY USES. `currentColor` — the engine's
 *    default — has no pixel value of its own, so it is resolved against the document. A
 *    picker that opened on a default nobody asked for would be picking a colour the
 *    visitor did not choose.
 *
 * 3. THE UPDATES ARE COALESCED INTO A FRAME. A colour input fires `input` on every pointer
 *    move — far more often than the screen refreshes — and each one would re-render the
 *    playground and repaint the field. One write per frame is what makes dragging feel
 *    like the thing under your finger is the thing on screen, which is the whole
 *    requirement of a "what you see is what you get" control.
 */
export function ColorPicker({
  value,
  onChange,
}: {
  /** the canonical colour, exactly as the engine will receive it */
  value: string | undefined;
  onChange: (color: string) => void;
}) {
  const [notation, setNotation] = useState<Notation>("hex");
  // The EDITABLE text, which is the source of truth for the field. Kept separate from
  // `value` so a half-typed string like `hsl(2` is not thrown away on every keystroke.
  const [draft, setDraft] = useState<string | null>(null);

  /** the canonical value, or the resolved `currentColor` when there is nothing set */
  const resolved = value ?? "currentColor";
  const shown = draft ?? format(resolved, notation) ?? resolved;
  // What the native swatch should show. It only speaks hex, so it cannot show
  // `var(--brand)`, a `color-mix()`, or `currentColor` itself — and all three reach this
  // control, the last one because it is the engine's DEFAULT.
  //
  // Resolved in an effect, not during render, and not from a ref: a ref is null during the
  // render that needs it, so reading one always fell through to black — a swatch reporting
  // black for dots that are not black. Reading the INHERITED colour off this element after
  // mount is the honest answer, and it picks up the theme, because that is genuinely what
  // `currentColor` means here.
  const [inherited, setInherited] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = root.current;
    if (!el || parseColor(resolved)) return; // an explicit colour needs no inheritance
    setInherited(resolveComputed("currentColor", el));
  }, [resolved]);
  const swatch = format(resolved, "hex") ?? inherited ?? "#000000";

  /** the pending frame, so a burst of events costs one write */
  const frame = useRef(0);
  /**
   * The colour the booked frame will write.
   *
   * A ref, because the frame must not close over a stale `value` the way a captured
   * `onChange` would — and NOT assigned during render, because a render is not consent to
   * overwrite: the parent still holds the previous value until the frame runs, so
   * `latest.current = value` on every render wiped the colour the moment someone picked
   * one, and the picker snapped back to `currentColor` before the frame ever fired.
   */
  const pending = useRef<string | null>(null);

  const commit = (color: string) => {
    pending.current = color;
    if (frame.current) return; // a frame is already booked; it will pick this value up
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      const next = pending.current;
      pending.current = null;
      if (next != null) onChange(next);
    });
  };

  // A booked frame must not survive unmount, or it fires into a dead tree.
  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  return (
    <div className="color-picker" ref={root}>
      <div className="color-picker-head">
        <label htmlFor="botui-color">{m.ctl_color()}</label>
        <div className="color-notation" role="group" aria-label={m.ctl_color_notation()}>
          {NOTATIONS.map((n) => (
            <button
              key={n}
              type="button"
              className={n === notation ? "is-on" : undefined}
              aria-pressed={n === notation}
              // A view, not an edit: the canonical value is untouched, which is why this
              // is not `onChange` and why nothing here goes through the rAF
              // Clearing the DRAFT is the part that matters. A half-typed or typed value
              // overrides the notation view, so without this, switching to HEX would keep
              // showing `hsl(0 100% 50%)` — the chip would read as broken. The draft was
              // already committed to the engine on every keystroke that parsed, so
              // dropping it here loses nothing.
              onClick={() => {
                setNotation(n);
                setDraft(null);
              }}
            >
              {notationLabel(n)}
            </button>
          ))}
        </div>
      </div>

      <div className="color-picker-row">
        {/* the native swatch: a real colour well, with the eyedropper and the OS picker */}
        <input
          type="color"
          className="color-swatch"
          value={swatch}
          aria-label={m.ctl_color_swatch()}
          onChange={(e) => {
            setDraft(null);
            commit(e.target.value);
          }}
        />
        <input
          id="botui-color"
          className="color-text"
          spellCheck={false}
          autoComplete="off"
          value={shown}
          onChange={(e) => {
            setDraft(e.target.value);
            // `parseColor`, NOT `format(…, notation)`: a person who typed hsl into a
            // field that happens to be showing HEX meant hsl, and asking the current
            // notation to interpret it would reject their own input.
            const raw = e.target.value.trim();
            const parsed = parseColor(raw);
            if (parsed) {
              commit(toHex(parsed));
              return;
            }
            // A value this picker cannot parse is still a value the ENGINE can take.
            // `var(--brand)`, `oklch(...)` and `color-mix(...)` all reach this control and
            // all work, because the engine hands the string to CSS untouched — so refusing
            // to commit them would make the control narrower than the component, and a
            // visitor who pasted a token from their design system would get nothing.
            //
            // What must NOT be committed is a HALF-TYPED value: `hsl(2` is a parse failure
            // that happens to be one of the shapes we pass through. The difference is that
            // a real CSS value has balanced brackets and is followed by nothing stray, so
            // an unclosed one is the signal. A visitor who typed half a token then sees the
            // field keep their text and the field keep its colour, which is the correct
            // reading of "not yet a value".
            if (looksLikeCompleteCss(raw)) commit(raw);
          }}
          // on blur, snap an abbreviated form to its full spelling: `#abc` → `#aabbcc`
          onBlur={() => {
            const parsed = parseColor(draft ?? shown);
            setDraft(null);
            if (parsed && isHex(draft ?? shown)) commit(toHex(parsed));
          }}
        />
      </div>

      {/* No note for a value the picker cannot edit. `var(--brand)` is a legitimate thing to
          hand this component and it must keep working, which it does — the field shows the
          value verbatim. A line of small grey text explaining that the thing on screen is
          the thing it was given is the definition of redundant: the field already says it,
          and a second, smaller copy of the same fact is the one people stop reading. */}
    </div>
  );
}

/**
 * Whether an unparseable string is plausibly a COMPLETE CSS colour rather than a
 * half-typed one.
 *
 * The picker passes values it cannot parse straight through, because the engine takes
 * them. That is only safe if a half-typed token is distinguishable — and it is, because
 * every real CSS colour value closes what it opens. `hsl(2` does not, so it stays a draft
 * and the field keeps the colour it had. This is a heuristic and is documented as one: it
 * would mis-classify a construct with balanced brackets that CSS then rejects, and the
 * consequence is a field that briefly shows an unparsed colour, which is what the engine
 * does with any string it is given.
 */
function looksLikeCompleteCss(v: string): boolean {
  if (!v) return false;
  const opens = (v.match(/\(/g) ?? []).length;
  const closes = (v.match(/\)/g) ?? []).length;
  if (opens !== closes) return false;
  // a bare function call is only complete if it is followed by something, not nothing:
  // `var(--x` has balanced brackets too, and is not a value
  return !/^[a-z-]+\([^()]*$/i.test(v.trim());
}
