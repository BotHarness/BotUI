import { useState } from "react";
import { m } from "../i18n.js";
import { snippet, type Tuning } from "./snippet.js";

/**
 * The tuning, as text you can carry away.
 *
 * The visitor came here to change something, and the change is worthless if leaving the
 * page loses it — they would have to remember that the dots wanted to overlap at 198%, that
 * 3% grow is the difference between a moving light and a pulsing blob. So this is a copy
 * button over the settings as they stand, not over the install command the visitor already
 * had a button for.
 *
 * It copies a PROMPT, not just a component: the command to run, the element with the
 * settings in it, and the stylesheet import. Whoever pastes it should not need this page
 * open beside them.
 */
export function ShowcaseCopy({ tuning }: { tuning: Tuning }) {
  const [state, setState] = useState<"idle" | "copied" | "manual">("idle");
  const text = snippet(tuning, {
    install: m.components_install({ name: "dot-matrix" }),
    intro: m.showcase_intro(),
    style: m.showcase_style(),
  });
  const label =
    state === "copied"
      ? m.showcase_copied()
      : state === "manual"
        ? m.showcase_manual()
        : m.showcase_copy();

  return (
    <div className="showcase-copy">
      <div className="showcase-copy-head">
        <p>{m.showcase_note()}</p>
        <button
          type="button"
          // the same refusal handling as InstallCommand: a clipboard write can fail on an
          // insecure origin or without permission, and a button that silently does nothing
          // is worse than no button
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(text);
              setState("copied");
            } catch {
              setState("manual");
            }
            setTimeout(() => setState("idle"), 1800);
          }}
        >
          {label}
        </button>
      </div>
      {/* Always rendered, never conditionally: a `manual` state has to have something to
          select. Hidden with CSS rather than unmounted so the text stays in the DOM. */}
      <pre className="showcase-copy-body" aria-hidden={state !== "manual"}>
        {text}
      </pre>
    </div>
  );
}
