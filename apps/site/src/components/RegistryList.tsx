import { useEffect, useState } from "react";
import { PRESETS, type PresetName } from "@botharness/botui-core";
import { m } from "../i18n.js";
import { Matrix } from "./Matrix.js";

interface RegistryItem {
  name: string;
  title?: string;
  description?: string;
  type: string;
  files?: unknown[];
  meta?: { botui?: { framework?: string } };
}

interface Registry {
  name: string;
  homepage: string;
  items: RegistryItem[];
}

/** a stable preset per name, so a card's preview does not change between loads */
function presetFor(name: string): PresetName {
  const motions = Object.keys(PRESETS).filter((k) => k !== "off") as PresetName[];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return motions[Math.abs(h) % motions.length]!;
}

/**
 * The registry index, read from the SAME document the CLI installs from.
 *
 * Not a copy in the page source: if this list and `registry.json` ever disagreed, the
 * page would be advertising components that cannot be installed, which is the one
 * thing a registry index must never do.
 */
export function RegistryList() {
  const [registry, setRegistry] = useState<Registry | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    fetch("/registry.json")
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
        return r.json() as Promise<Registry>;
      })
      .then((doc) => {
        if (live) setRegistry(doc);
      })
      .catch((e: Error) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, []);

  if (error) {
    return <p className="registry-error">{m.components_error({ reason: error })}</p>;
  }
  if (!registry) return <p className="registry-loading">{m.components_loading()}</p>;

  return (
    <div className="registry-grid">
      {registry.items.map((item) => (
        <article key={item.name} className="registry-card">
          <div className="registry-preview">
            <Matrix
              size={84}
              cols={6}
              rows={6}
              silhouette={item.meta?.botui?.framework === "react" ? "hex" : "circle"}
              preset={presetFor(item.name)}
              dot={item.meta?.botui?.framework === "react" ? "circle" : "square"}
              // same reason as the playground: 0.16 is nearly invisible at 84px
              floor={0.34}
            />
          </div>
          <h3>{item.title ?? item.name}</h3>
          <code className="registry-install">{m.components_install({ name: item.name })}</code>
          <p>{item.description}</p>
        </article>
      ))}
    </div>
  );
}
