#!/usr/bin/env node
/**
 * Build the registry from the packages.
 *
 * The registry is GENERATED, never hand-written, and that is the whole point: a
 * hand-maintained `r/dot-matrix.json` carrying a copy of the source is a second
 * source of truth that goes stale the first time a line changes upstream. Here the
 * JSON is a projection of `packages/*`, so `npx shadcn add` and a local checkout
 * install byte-identical code.
 *
 * Two items, because they are two decisions a caller makes separately:
 *
 *   dot-matrix          the framework-agnostic engine + its stylesheet
 *   dot-matrix-react    the <DotMatrix> wrapper, which registry-depends on the above
 *
 * The schema is shadcn's, so `npx shadcn@latest add <url>` works against these URLs
 * as well as against our own CLI. Being compatible is a property worth having: it
 * means nobody has to take our installer on trust.
 */
import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const core = join(root, "packages", "core");
const react = join(root, "packages", "react");
const out = join(root, "apps", "site", "public");

const REGISTRY_SCHEMA = "https://ui.shadcn.com/schema/registry.json";
const ITEM_SCHEMA = "https://ui.shadcn.com/schema/registry-item.json";

const read = (p) => readFile(p, "utf8");

/**
 * The engine, shipped with its SOURCE STRUCTURE INTACT under `components/botui/`.
 *
 * That is not tidiness, it is correctness. The modules import each other relatively
 * (`../types.js`, `../internal/math.js`), so flattening them into one folder would
 * break every import in the installed copy — and the failure would appear in the
 * user's build, not ours. Preserving the tree means the copy resolves exactly as the
 * original does, with no import rewriting at all.
 */
const ENGINE_FILES = [
  "src/index.ts",
  "src/types.ts",
  "src/internal/math.ts",
  "src/dot-matrix/lattice.ts",
  "src/dot-matrix/order.ts",
  "src/dot-matrix/envelope.ts",
  "src/dot-matrix/glyph.ts",
  "src/dot-matrix/layout.ts",
  "src/dot-matrix/presets.ts",
  "src/dot-matrix/field.ts",
  "src/dot-matrix/css.ts",
  "src/dot-matrix/matrix.ts",
];

const files = async (base, sources, dir, transform = (s) => s) =>
  Promise.all(
    sources.map(async (from) => {
      const to = from.replace(/^src\//, "");
      return {
        path: `${dir}/${to}`,
        type: to.endsWith(".css") ? "registry:style" : "registry:component",
        target: `${dir}/${to}`,
        content: transform(await read(join(base, from))),
      };
    }),
  );

async function main() {
  const cssPath = join(core, "dist", "botui-dot-matrix.css");
  if (!existsSync(cssPath)) {
    throw new Error(
      "botui: the stylesheet has not been built yet. Run `pnpm build` first — the CSS is\n" +
        "       generated from the same envelope functions the runtime uses, so it is an\n" +
        "       artefact and cannot be written by hand.",
    );
  }

  const engine = [
    ...(await files(core, ENGINE_FILES, "components/botui")),
    {
      path: "components/botui/dot-matrix/dot-matrix.css",
      type: "registry:style",
      target: "components/botui/dot-matrix/dot-matrix.css",
      content: await read(cssPath),
    },
  ];

  // The one transform the build performs. In this repo the wrapper imports the
  // engine by package name; in the user's project that package does not exist,
  // because copy-and-own means they now OWN the code. So the bare specifier becomes
  // a relative path to the sibling folder. It is the only rewrite, and
  // check-registry.mjs fails the build if any item still imports a package it does
  // not declare — which is exactly how this transform stays honest.
  const REWRITE = { "@botharness/botui-core": "../botui/index.js" };
  const reactFiles = await files(react, ["src/index.tsx"], "components/botui-react", (source) => {
    let out = source;
    for (const [from, to] of Object.entries(REWRITE)) {
      out = out.replaceAll(`'${from}'`, `'${to}'`).replaceAll(`"${from}"`, `"${to}"`);
    }
    return out;
  });

  const items = [
    {
      $schema: ITEM_SCHEMA,
      name: "dot-matrix",
      type: "registry:component",
      title: "Dot Matrix",
      description:
        "A loading indicator built as five replaceable layers — lattice, traversal, brightness envelope, dot polygon, renderer. Ships an SVG renderer that paints per frame and a CSS renderer that hands the motion to the browser at zero JS per frame; both are driven by the same field, so they cannot disagree.",
      author: "BotHarness",
      dependencies: [],
      devDependencies: [],
      registryDependencies: [],
      files: engine,
      categories: ["feedback", "loading", "animation"],
      docs: "https://ui.botharness.ai/docs/dot-matrix",
      meta: {
        botui: {
          renderer: ["svg", "css"],
          framework: "none",
          layerCount: 5,
        },
      },
    },
    {
      $schema: ITEM_SCHEMA,
      name: "dot-matrix-react",
      type: "registry:component",
      title: "Dot Matrix (React)",
      description:
        'The <DotMatrix> wrapper: a ref, a lifecycle, and a props→options translation. Every pixel comes from the engine, so there is no second renderer to keep in step. Add `state="thinking"` and the motion is chosen for you.',
      author: "BotHarness",
      dependencies: [],
      devDependencies: [],
      registryDependencies: ["dot-matrix"],
      files: reactFiles,
      categories: ["feedback", "loading", "animation"],
      docs: "https://ui.botharness.ai/docs/dot-matrix",
      meta: {
        botui: {
          framework: "react",
          requires: "dot-matrix",
        },
      },
    },
  ];

  const registry = {
    $schema: REGISTRY_SCHEMA,
    name: "botui",
    homepage: "https://ui.botharness.ai",
    items,
  };

  await rm(join(out, "r"), { recursive: true, force: true });
  await mkdir(join(out, "r"), { recursive: true });
  await writeFile(join(out, "registry.json"), `${JSON.stringify(registry, null, 2)}\n`, "utf8");
  for (const item of items) {
    await writeFile(
      join(out, "r", `${item.name}.json`),
      `${JSON.stringify(item, null, 2)}\n`,
      "utf8",
    );
  }

  const filesWritten = items.reduce((n, i) => n + i.files.length, 0);
  process.stdout.write(
    `registry: ${items.length} items, ${filesWritten} files → ${relative(root, out)}\n` +
      items.map((i) => `  r/${i.name}.json`).join("\n") +
      "\n",
  );
}

await main();
