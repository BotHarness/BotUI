import type { ReactNode } from "react";
import { cellsFor, glyphPath, type Silhouette } from "@botharness/botui-core";

/** the card's width in the scrolling row: enough for the picture plus two label lines */
const CARD_W = 86;

/**
 * A choice you can see rather than a control you have to imagine.
 *
 * The engine has two independent notions of "shape" that used to sit in one slider
 * group, so a slider labelled `sides` sat next to one labelled `silhouette` and a reader
 * had no way to know which moved the whole field and which moved each dot. Each card
 * therefore carries the SCOPE it acts on, in the same place on every card, so the
 * distinction is visible before you click anything: the silhouette row's cards change
 * the outline of the whole field, the dot row's cards change each dot inside it.
 *
 * Selecting is a radio group, not a set of buttons: a screen reader announces "3 of 14"
 * and arrow keys move between options, which a grid of buttons does not. `role` and the
 * roving tabindex come from the fieldset semantics rather than from JavaScript.
 */
export function CardGroup<T extends string>({
  label,
  /** what this group changes, shown once at the top: "the whole field" / "each dot" */
  scope,
  value,
  options,
  onChange,
  renderPreview,
  columns,
}: {
  label: string;
  scope: string;
  /** the option may legitimately be unset, which is what the engine's own default is */
  value: T | undefined;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  /** the card's visual — the engine's own output, not an illustration of it */
  renderPreview: (value: T) => ReactNode;
  /** the card's fixed width; the row scrolls horizontally past this count */
  columns?: number;
}) {
  return (
    <fieldset
      className="card-group"
      style={{ "--card-w": `${CARD_W}px` } as React.CSSProperties}
      data-overflow={options.length > (columns ?? 4) || undefined}
    >
      <legend>{label}</legend>
      <p className="card-scope">{scope}</p>
      <div className="card-grid">
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <label
              key={option.value}
              className="card"
              // the input is the control; the label wraps it, so the whole card is the
              // hit target and the accessible name comes from the text inside
              data-selected={selected || undefined}
            >
              <input
                type="radio"
                name={label}
                value={option.value}
                checked={selected}
                onChange={() => onChange(option.value)}
              />
              <span className="card-preview" aria-hidden="true">
                {renderPreview(option.value)}
              </span>
              <span className="card-label">{option.label}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/**
 * The field's outline, drawn as the cells that exist.
 *
 * NOT a `Still`. A still frame at phase 0 runs the motion, and at phase 0 most cells
 * sit at the resting level — so `ring` and `circle` both came out as a uniform smudge
 * of near-invisible dots, and the card that exists to answer "which cells does this
 * silhouette keep?" answered it with "a faint blob". The silhouette is a question about
 * the LATTICE, not about the motion, so this asks the lattice directly.
 *
 * `cellsFor` is the engine's own function, so this cannot disagree with what the field
 * below it renders; the only thing decided here is the dot size, chosen to fill the
 * cell so the shape reads at 44px.
 */
export function SilhouetteCard({
  value,
  size = 44,
  cols = 7,
  rows = 7,
}: {
  value: Silhouette;
  size?: number;
  cols?: number;
  rows?: number;
}) {
  const cells = cellsFor(cols, rows, value);
  // one dot per cell, at the pitch the engine would use with no gap and a dot that
  // fills its cell — so the card shows the shape and not an accident of spacing
  const pitch = size / (cols + 1);
  const dot = glyphPath({ sides: 4, radius: 0 }).d;
  const scale = (pitch * 0.82) / 2;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`${-size / 2} ${-size / 2} ${size} ${size}`}
      fill="currentColor"
      aria-hidden="true"
    >
      {cells.map((cell) => (
        <path
          key={`${cell.col}-${cell.row}`}
          d={dot}
          transform={`translate(${(cell.nx * size) / 2} ${(cell.ny * size) / 2}) scale(${scale})`}
        />
      ))}
    </svg>
  );
}
