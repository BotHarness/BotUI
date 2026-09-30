/**
 * The catalogue's integrity.
 *
 * Paraglide does NOT fail on a missing translation: a key absent from `zh.json`
 * silently falls back to the base locale. That is the right runtime behaviour and the
 * wrong authoring one — a half-translated Chinese page looks fine in a diff and wrong
 * to every reader, and nothing else in the build will say so.
 */
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const site = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (name: string) =>
  readFile(join(site, "messages", `${name}.json`), "utf8").then(JSON.parse);

describe("the message catalogue", () => {
  it("every locale defines exactly the same keys", async () => {
    const en = await read("en");
    const zh = await read("zh");
    const keys = (o: object) => Object.keys(o).sort();
    expect(
      keys(zh),
      "a key present in en but missing in zh would silently fall back to English",
    ).toEqual(keys(en));
  });

  it("no locale carries a key the other does not", async () => {
    const en = await read("en");
    const zh = await read("zh");
    expect(Object.keys(en).filter((k) => !(k in zh))).toEqual([]);
    expect(Object.keys(zh).filter((k) => !(k in en))).toEqual([]);
  });

  it("every value is a non-empty string", async () => {
    for (const name of ["en", "zh"]) {
      for (const [key, value] of Object.entries(await read(name))) {
        expect(typeof value, `${name}.${key}`).toBe("string");
        expect(
          value.trim().length,
          `${name}.${key} is empty — it renders as nothing`,
        ).toBeGreaterThan(0);
      }
    }
  });

  it("no PROSE message is left identical in both locales", async () => {
    /**
     * A key-by-key copy-paste leaves the Chinese page in English and looks fine in a
     * diff. Key parity does not catch it, and neither does the compiler: Paraglide
     * compiles both locales happily.
     *
     * Some values ARE legitimately identical — a brand name, a shell command, an
     * option identifier that is the same word in both languages, a format string.
     * Those are declared rather than excused, so adding a real untranslated string
     * fails here instead of quietly shipping.
     */
    const IDENTICAL_BY_DESIGN = new Set([
      "brand",
      "nav_github",
      "install_command",
      "components_install",
      "value_speed",
      "ctl_size",
      "ctl_cols",
      "ctl_rows",
      "ctl_preset",
      // a stylesheet import is code, not prose — it is the same bytes in both languages
      // for the same reason `install_command` is: the copy has to paste and run
      "showcase_style",
    ]);
    const en = await read("en");
    const zh = await read("zh");
    const identical = Object.keys(en).filter((k) => en[k] === zh[k] && !IDENTICAL_BY_DESIGN.has(k));
    expect(
      identical,
      `identical in both locales and not on the by-design list:\n  ${identical.map((k) => `${k} = ${JSON.stringify(en[k])}`).join("\n  ")}`,
    ).toEqual([]);
  });

  it("every key a component uses is in the catalogue", async () => {
    // Paraglide types these at compile time, so a typo is a build error — but only for
    // the keys the compiler can see. This catches a key that exists in the catalogue
    // and is never rendered, which is a translation nobody asked for.
    const en = await read("en");
    const used = new Set<string>();
    for (const file of [
      "components/Playground.tsx",
      "components/RegistryList.tsx",
      "components/InstallCommand.tsx",
      // a NEW component must join this list, or its messages read as unrendered and the
      // scan silently stops covering half the site
      "components/ShowcaseCopy.tsx",
      "i18n.ts",
      "components/Home.astro",
      "layouts/Base.astro",
      "components/LocaleSwitch.astro",
    ]) {
      const source = await readFile(join(site, "src", file), "utf8");
      // camelCase too: a lowercase-only class silently truncates `dir_leftToRight` to
      // `dir_leftToR`, which reads as an unused key and made every direction label look
      // unrendered
      for (const match of source.matchAll(/\bm\.([A-Za-z0-9_]+)/g)) used.add(match[1]!);
    }
    expect(
      used.size,
      "no message keys found — the scan is looking in the wrong place",
    ).toBeGreaterThan(20);
    for (const key of Object.keys(en)) {
      expect(used.has(key), `messages/${key} is defined but never rendered`).toBe(true);
    }
  });
});
