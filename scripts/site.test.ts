// @vitest-environment node
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const site = join(root, "apps", "site");
const dist = join(site, "dist");
const src = join(site, "src");

const hash = (s: string) => createHash("sha256").update(s).digest("hex").slice(0, 12);
const distExists = existsSync(dist);
const skip = distExists ? "" : " — run `pnpm build` first";

/**
 * The site is the only place the component runs in a browser nobody is watching, so it
 * gets the same class of check as the library.
 *
 * These are deliberately about the BUILD OUTPUT rather than the source. A docs site
 * that typechecks and fails to render is a docs site nobody reads, and the two failure
 * modes that actually shipped here — an unstyled page, and a field that drew nothing —
 * were both invisible to every check that looked at the source.
 */
describe("the built site", () => {
  it("exists, and serves the registry from its own origin", async () => {
    if (!distExists) throw new Error(`no build at ${dist}${skip}`);
    const registry = JSON.parse(await readFile(join(dist, "registry.json"), "utf8"));
    expect(registry.items.length).toBeGreaterThan(0);
    // the per-item URLs are what `npx shadcn add` and the CLI both fetch
    for (const item of registry.items) {
      expect(existsSync(join(dist, "r", `${item.name}.json`)), `${item.name} is not served`).toBe(
        true,
      );
    }
  });

  it("the page is a real Astro page with hydrated islands", async () => {
    if (!distExists) throw new Error(`no build at ${dist}${skip}`);
    const html = await readFile(join(dist, "index.html"), "utf8");
    // `astro-island` is how an island is marked; without it the components are
    // server-rendered markup that never becomes interactive
    expect(html, "no hydrated islands — the page is static markup").toContain("astro-island");
    expect(html, "no island is hydrated").toMatch(/client="(visible|load)"/);
    expect(html).toContain("npx @botharness/botui add dot-matrix");
  });

  it("the CSS bundle carries BOTH the page rules and the component rules", async () => {
    // The regression this exists for: a build emitted the component stylesheet under
    // the page stylesheet's name, overwrote the source, and shipped a site with no
    // page styles at all — while every source-level check passed. Now the component
    // stylesheet is imported from the package, so the check is that the ONE bundle
    // has both, and neither has swallowed the other.
    if (!distExists) throw new Error(`no build at ${dist}${skip}`);
    const assets = join(dist, "assets");
    const css = (await readdir(assets)).filter((f) => f.endsWith(".css"));
    expect(css.length, "no stylesheet was emitted").toBeGreaterThan(0);
    const all = (await Promise.all(css.map((f) => readFile(join(assets, f), "utf8")))).join("\n");

    for (const selector of [
      ":root",
      ".top",
      ".lede",
      ".install",
      ".playground",
      ".registry-grid",
    ]) {
      expect(all, `the page rules are missing ${selector}`).toContain(selector);
    }
    for (const token of ["--ink", "--muted", "--line"]) {
      expect(all, `the page tokens are missing ${token}`).toContain(token);
    }
    // the component's own rules have to be there too, or the CSS renderer in the
    // playground has keyframes and no layout
    expect(all, "the component stylesheet is not in the bundle").toContain(".botui-dot-matrix");
    expect(all, "the component keyframes are not in the bundle").toContain("@keyframes botui-dm-");
  });

  it("the engine is in the CLIENT bundle, so the demo is not a mock", async () => {
    if (!distExists) throw new Error(`no build at ${dist}${skip}`);
    const assets = join(dist, "assets");
    const js = (await readdir(assets)).filter((f) => f.endsWith(".js"));
    const all = (await Promise.all(js.map((f) => readFile(join(assets, f), "utf8")))).join("\n");
    // the component's own strings, not just its exports: a page could import the
    // package for its types and render something else entirely
    expect(all, "the engine did not reach the client bundle").toContain("botui-dot-matrix");
    expect(all).toContain("botui-dm-");
    // and React is really there, not a hand-rolled stand-in
    expect(all).toContain("react");
  });

  it("the component stylesheet the page uses is the one the package exports", async () => {
    // one copy of the rules, from the build, not a second hand-maintained file
    const pkg = JSON.parse(await readFile(join(root, "packages/core/package.json"), "utf8"));
    expect(pkg.exports["./style.css"], "the package no longer exports its stylesheet").toBe(
      "./dist/botui-dot-matrix.css",
    );
    const layout = await readFile(join(src, "layouts/Base.astro"), "utf8");
    expect(layout, "the layout does not import the component stylesheet").toContain(
      "@botharness/botui-core/style.css",
    );
  });
});

describe("the site source", () => {
  it("the demos mount the engine directly, not through the React wrapper", async () => {
    // a docs site that demos its own component through its own wrapper inherits every
    // fix and reports the component works. The playground has to exercise core.
    const matrix = await readFile(join(src, "components/Matrix.tsx"), "utf8");
    expect(matrix, "the demo must not import the React wrapper").not.toContain(
      "@botharness/botui-react",
    );
    expect(matrix).toContain("createDotMatrix");
    expect(matrix).toContain("@botharness/botui-core");
  });

  it("the playground explains the two size vocabularies, not just one number", async () => {
    // `dot / cell` and `dot / pitch` are different numbers and only one means
    // anything to the eye: 100% of the pitch is two dots touching
    const playground = await readFile(join(src, "components/Playground.tsx"), "utf8");
    // the copy moved into the message catalogues when the page became bilingual, so
    // asserting the literal in the component would assert a string that is no longer
    // there. What has to hold is that the readout renders BOTH vocabularies and that
    // it computes the touching threshold rather than hard-coding it.
    expect(playground).toContain("readout_dot_pitch");
    expect(playground).toContain("readout_touching_hint");
    expect(playground).toContain("touchingDotSize");

    const en = JSON.parse(await readFile(join(src, "../messages/en.json"), "utf8"));
    expect(en.readout_dot_pitch).toBe("dot / pitch");
    expect(en.readout_touching_hint).toMatch(/two dots touching/);
  });

  it("the registry list reads the registry rather than restating it", async () => {
    // a hardcoded list on the page would advertise components that cannot be installed
    const list = await readFile(join(src, "components/RegistryList.tsx"), "utf8");
    expect(list).toMatch(/fetch\(["']\/registry\.json["']\)/);
  });

  it("the install command on the page is the one the README documents", async () => {
    // two different install commands on one site is how nobody ends up with the right
    // one. The command is a MESSAGE now, so the check reads the catalogue and the
    // rendered page rather than hunting for a literal in a template.
    const home = await readFile(join(site, "src/components/Home.astro"), "utf8");
    const readme = await readFile(join(root, "README.md"), "utf8");
    const catalogue = JSON.parse(await readFile(join(site, "messages/en.json"), "utf8")) as Record<
      string,
      string
    >;
    const command = catalogue.install_command;
    expect(command, "the catalogue no longer carries the install command").toBeTruthy();
    expect(home, "the page must render the command from the catalogue").toContain(
      "m.install_command()",
    );
    expect(readme, "the README must document the same command the page shows").toContain(command!);
  });

  it("the site renders both locales from one page body", async () => {
    // two copies of a page is two things that can drift; the locale has to be a
    // parameter, not a fork
    const pages = (await readdir(join(src, "pages"), { recursive: true }))
      .filter((f) => f.endsWith(".astro"))
      .map(String);
    expect(pages.sort()).toEqual(["[locale]/index.astro", "index.astro"]);
    const root = await readFile(join(src, "pages/index.astro"), "utf8");
    const prefixed = await readFile(join(src, "pages/[locale]/index.astro"), "utf8");
    // both delegate to the same component
    expect(root).toContain("<Home />");
    expect(prefixed).toContain("<Home />");
    const home = await readFile(join(site, "src/components/Home.astro"), "utf8");
    expect(home, "Home must not branch on the locale itself").not.toMatch(/if\s*\(\s*locale/);
  });

  it("the deploy target is Cloudflare Pages, and the build output is static", async () => {
    // a Worker with static assets and a Pages project are different products with
    // different URLs; the registry is served from the second one
    const config = await readFile(join(site, "astro.config.mjs"), "utf8");
    expect(config, "the site must be a static build for Pages").toContain("output: 'static'");
    const pkg = JSON.parse(await readFile(join(site, "package.json"), "utf8"));
    expect(pkg.scripts.deploy).toContain("pages deploy");
  });

  it("the typecheck covers the site, and says what it cannot cover", async () => {
    // `astro check` does not support TypeScript 7 yet, so the .astro files are NOT
    // typechecked. That is a real gap and it belongs in the file that runs the check,
    // not in someone's memory.
    const scripts = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
    expect(scripts.scripts.typecheck, "the site is not typechecked").toContain("apps/site");
    const agents = await readFile(join(root, "AGENTS.md"), "utf8");
    expect(agents, "the astro-check gap is undocumented").toMatch(/astro check/);
  });
});

describe("the engine the site runs", () => {
  it("the site imports the built engine, so the demo is the same implementation", async () => {
    const built = join(root, "packages/core/dist/index.js");
    if (!existsSync(built)) throw new Error(`no engine build at ${built}${skip}`);
    const mod = (await import(built)) as Record<string, unknown>;
    // every name the site's components import
    const sources = await Promise.all(
      (await readdir(join(src, "components"))).map((f) =>
        readFile(join(src, "components", f), "utf8"),
      ),
    );
    const wanted = new Set<string>();
    for (const source of sources) {
      for (const statement of source.matchAll(
        /import\s*\{([^}]+)\}\s*from\s*['"]@botharness\/botui-core['"]/g,
      )) {
        for (const name of (statement[1] ?? "").split(",")) {
          // a `type` import is erased at runtime, so asking whether it is a runtime
          // export is the wrong question; whether it RESOLVES is tsc's job
          const clean = name.trim();
          if (clean && !clean.startsWith("type ")) wanted.add(clean);
        }
      }
    }
    expect(wanted.size, "the site imports nothing from the engine").toBeGreaterThan(5);
    for (const name of wanted) {
      expect(name in mod, `the site imports ${name}, which the engine does not export`).toBe(true);
    }
  });

  it("the engine build is the one the registry was generated from", async () => {
    // the registry ships source and the site runs the build, so they are different
    // bytes by design. What has to hold is that both come from the same commit of the
    // same tree — which is why the registry is generated rather than maintained.
    const item = JSON.parse(await readFile(join(site, "public/r/dot-matrix.json"), "utf8"));
    const source = item.files.find((f: { path: string }) =>
      f.path.endsWith("dot-matrix/matrix.ts"),
    );
    const onDisk = await readFile(join(root, "packages/core/src/dot-matrix/matrix.ts"), "utf8");
    expect(hash(source.content), "the registry copy has drifted from the source").toBe(
      hash(onDisk),
    );
  });
});

describe("what the toolchain cannot check", () => {
  it("records the astro-check / TypeScript 7 gap in the repo", () => {
    // `astro check` refuses TypeScript 7, so `.astro` files are not typechecked. The
    // risk is a typo in a template expression failing at build time rather than in
    // review; the build catches it, but only for the pages that exist.
    const agents = readFileSync(join(root, "AGENTS.md"), "utf8");
    expect(agents).toMatch(/TypeScript 7/);
    expect(agents).toMatch(/not typechecked|\.astro/);
  });
});
