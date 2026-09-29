import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const site = join(root, "apps", "site");
const sitePublic = join(site, "public");
const built = join(root, "packages", "core", "dist", "index.js");

/**
 * The site is the only place that runs the component in a browser we do not control,
 * so it gets the same class of check as the library: every name it imports has to
 * exist, and every file it loads has to be there.
 *
 * A demo page is where a renamed export goes to die — the page still parses, the
 * script still loads, and the field is simply absent.
 */
const hash = (s: string) => createHash("sha256").update(s).digest("hex").slice(0, 12);

describe("the site", () => {
  it("the demo does not import itself", async () => {
    // A build step that writes two artifacts to one path does not fail: the second
    // simply wins, the page parses, and the component is silently gone. The demo
    // importing the file it IS is that bug, exactly.
    const source = await readFile(join(sitePublic, "botui.js"), "utf8");
    const specifiers = [...source.matchAll(/from\s*["']\.\/([\w.-]+)["']/g)].map((m) => m[1]!);
    expect(specifiers.length).toBeGreaterThan(0);
    expect(specifiers, "the demo imports its own file").not.toContain("botui.js");
    for (const specifier of specifiers) {
      expect(
        existsSync(join(sitePublic, specifier)),
        `${specifier} is imported but not staged`,
      ).toBe(true);
    }
  });

  it("the demo's engine import is the build, not a source copy", async () => {
    // the demo has to run the same bytes a user installs
    const source = await readFile(join(sitePublic, "botui.js"), "utf8");
    const [specifier] = [...source.matchAll(/from\s*["']\.\/([\w.-]+)["']/g)].map((m) => m[1]!);
    const staged = await readFile(join(sitePublic, specifier!), "utf8");
    // named apart from the module-level path: a `const built` here would shadow it
    // and read as a self-reference
    const engineBytes = await readFile(built, "utf8");
    // the build's sourceMappingURL is rewritten to the staged filename, and that one
    // comment is the ONLY permitted difference — anything else means the demo is
    // running code a user would not get
    const strip = (text: string) => text.replace(/\/\/# sourceMappingURL=\S+/, "");
    expect(hash(strip(staged)), "the staged engine is not the build").toBe(
      hash(strip(engineBytes)),
    );
    expect(staged, "the staged engine still points at a map that is not there").toContain(
      "sourceMappingURL=botui-engine.js.map",
    );
  });

  it("every name the demo imports is exported by the build", async () => {
    if (!existsSync(built)) {
      throw new Error("the site needs packages/core/dist — run `pnpm build` before this suite");
    }
    const source = await readFile(join(sitePublic, "botui.js"), "utf8");
    const mod = (await import(built)) as Record<string, unknown>;
    const statements = source.matchAll(/import\s*\{([^}]+)\}\s*from\s*["']\.\/([\w.-]+)["']/g);
    const imported = [...statements]
      .flatMap((m) => (m[1] ?? "").split(","))
      .map((name) => name.trim())
      .filter(Boolean);
    expect(imported.length).toBeGreaterThan(5);
    for (const name of imported) {
      expect(name in mod, `the demo imports ${name}, which the build does not export`).toBe(true);
    }
  });

  it("the tables the demo renders controls from are non-empty", async () => {
    const mod = (await import(built)) as Record<string, unknown>;
    for (const key of [
      "PRESET_KEYS",
      "SILHOUETTE_KEYS",
      "DOT_SHAPE_KEYS",
      "DOT_SHAPES",
      "PRESETS",
    ]) {
      const value = mod[key];
      expect(value, key).toBeDefined();
      const size = Array.isArray(value) ? value.length : Object.keys(value as object).length;
      expect(size, `${key} is empty — the demo would render blank controls`).toBeGreaterThan(0);
    }
  });

  it("every file the page references is served", async () => {
    const html = await readFile(join(site, "index.html"), "utf8");
    const referenced = [
      ...[...html.matchAll(/(?:href|src)="(\/[^"#?]+)"/g)].map((m) => m[1]!),
      // the favicon is inlined, and the module graph resolves relative to the page
      ...[...html.matchAll(/(?:from|import)\s*['"](\/[^'"]+)['"]/g)].map((m) => m[1]!),
    ];
    for (const path of new Set(referenced)) {
      expect(
        existsSync(join(sitePublic, path.replace(/^\//, ""))),
        `${path} is referenced but missing`,
      ).toBe(true);
    }
  });

  it("every element the demo reaches for exists in the markup", async () => {
    // a null from querySelector is a TypeError on the first line of a handler, and
    // it only shows up in a browser nobody is watching
    const js = await readFile(join(sitePublic, "botui.js"), "utf8");
    const html = await readFile(join(site, "index.html"), "utf8");
    const ids = new Set([...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1]!));
    const wanted = [...js.matchAll(/\$\(["']#([a-z-]+)["']\)/g)].map((m) => m[1]!);
    expect(wanted.length).toBeGreaterThan(5);
    for (const id of new Set(wanted)) {
      expect(ids.has(id), `the demo reaches for #${id}, which the page does not define`).toBe(true);
    }
  });

  it("the install command on the page is the one the README documents", async () => {
    // two different install commands on one site is how nobody ends up with the right one
    const html = await readFile(join(site, "index.html"), "utf8");
    const readme = await readFile(join(root, "README.md"), "utf8");
    const fromPage = html.match(/id="install-cmd">([^<]+)</)?.[1]?.trim();
    expect(fromPage).toBe("npx @botharness/botui add dot-matrix");
    expect(readme).toContain(fromPage!);
  });
});

describe("the demo, executed", () => {
  it("runs the real page and paints the field", async () => {
    // The bug this catches: a build step wrote the engine and the demo to the same
    // path, the demo won, the page parsed fine, and the component was simply absent.
    // Every static check above passed while the page was broken.
    const { JSDOM } = await import("jsdom");
    const { pathToFileURL } = await import("node:url");
    const html = await readFile(join(site, "index.html"), "utf8");

    const dom = new JSDOM(html, { url: "https://ui.botharness.ai/" });
    const errors: string[] = [];
    dom.window.addEventListener("error", (e: ErrorEvent) => errors.push(e.message));
    // give the module the globals it expects from a browser. `navigator` is left
    // alone: in this environment it is a getter-only global, and assigning to it
    // throws. The demo never reads it, so there is nothing to provide.
    const g = globalThis as Record<string, unknown>;
    const saved = {
      document: g.document,
      window: g.window,
      requestAnimationFrame: g.requestAnimationFrame,
      cancelAnimationFrame: g.cancelAnimationFrame,
      fetch: g.fetch,
    };
    g.document = dom.window.document;
    g.window = dom.window;
    // the engine drives itself with rAF. jsdom only provides it under
    // pretendToBeVisual, so a plain frame queue stands in — the test is about the
    // field being painted, not about frame timing
    let handle = 0;
    const frames = new Map<number, FrameRequestCallback>();
    g.requestAnimationFrame = ((cb: FrameRequestCallback) => {
      frames.set(++handle, cb);
      return handle;
    }) as typeof requestAnimationFrame;
    g.cancelAnimationFrame = ((id: number) => frames.delete(id)) as typeof cancelAnimationFrame;
    // The demo reads the registry over the network. It has to be globalThis.fetch,
    // not dom.window.fetch: the demo is a module running in THIS realm, so a window
    // method it never calls is not what its bare `fetch(...)` resolves to. (It fails
    // quietly, too — the demo catches and renders an error string.)
    const serve = async (url: string) => {
      const rel = String(url).replace("https://ui.botharness.ai/", "");
      const body = await readFile(join(sitePublic, rel), "utf8");
      return { ok: true, status: 200, json: async () => JSON.parse(body) } as unknown as Response;
    };
    g.fetch = serve;
    dom.window.fetch = serve as typeof fetch;

    try {
      const module = await import(pathToFileURL(join(sitePublic, "botui.js")).href);
      void module;
      // the demo is top-level-await driven; let its async tail settle
      await new Promise((r) => setTimeout(r, 50));

      const d = dom.window.document;
      expect(errors, `the demo threw: ${errors.join("; ")}`).toEqual([]);
      // the stage has a real field on it
      expect(
        d.querySelectorAll("#stage svg path").length,
        "the stage field is empty",
      ).toBeGreaterThan(10);
      // the controls are populated from the engine's tables
      expect(d.querySelectorAll("#preset option").length).toBeGreaterThan(3);
      expect(d.querySelectorAll("#silhouette option").length).toBeGreaterThan(3);
      expect(d.querySelectorAll("#dot option").length).toBeGreaterThan(3);
      // the registry rendered, and each card got a live preview
      expect(d.querySelectorAll("#registry-list .card").length).toBeGreaterThan(0);
      expect(d.querySelectorAll("#registry-list .preview svg").length).toBeGreaterThan(0);
      // the readout explains the two size vocabularies
      expect(d.querySelector("#readout")?.textContent).toContain("two dots touching");
    } finally {
      for (const [k, v] of Object.entries(saved)) {
        if (v === undefined) delete g[k];
        else g[k] = v;
      }
      dom.window.close();
    }
  });
});
