import { useState } from "react";
import { m } from "../i18n.js";

/**
 * The install command, with a copy button.
 *
 * A clipboard write can be refused (no permission, an insecure origin), and a button
 * that silently does nothing is worse than no button — so the fallback selects the
 * text and says so, which the reader can copy by hand.
 */
export function InstallCommand({ command }: { command: string }) {
  const [state, setState] = useState<"idle" | "copied" | "manual">("idle");
  const label =
    state === "copied"
      ? m.install_copied()
      : state === "manual"
        ? m.install_manual()
        : m.install_copy();

  return (
    <div className="install">
      <code>{command}</code>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(command);
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
  );
}
