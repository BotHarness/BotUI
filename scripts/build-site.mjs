import { copyFile, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
/**
 * Assemble the site into apps/site/dist.
 *
 * The demo page loads the BUILT engine, not a copy of the source: the file served as
 * /botui-engine.js is the same artifact the registry item ships. A demo running on
 * different code from the one you install is worse than no demo, because it looks
 * like evidence.
 */
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const site = join(root, "apps", "site");
const publicDir = join(site, "public");
const dist = join(site, "dist");

/** every path this script writes, so a collision fails loudly instead of silently */
const written = new Set();
async function emit(from, to) {
  if (written.has(to)) {
    throw new Error(
      `site: two artifacts want the same output path — ${relative(root, to)}.\n` +
        `      One of them would overwrite the other and the page would break in a way\n` +
        `      nothing else here would catch. Give them distinct names.`,
    );
  }
  written.add(to);
  await mkdir(dirname(to), { recursive: true });
  await copyFile(from, to);
}

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

// The engine is staged INTO public/ first, so the demo's relative import
// ('./botui-engine.js') resolves in the built site, in a dev server rooted at
// public/, and in the test that executes the demo — one arrangement, three places.
//
// Its sourceMappingURL comment is rewritten to the staged name. Left alone, the
// bundle points at index.js.map, which does not exist next to it: browsers and
// bundlers both fail on the missing map, and a dev server logs a 404 on every
// reload for a file nobody asked for.
const engine = join(root, "packages/core/dist/index.js");
const engineSource = (await readFile(engine, "utf8")).replace(
  /\/\/# sourceMappingURL=\S+/,
  "//# sourceMappingURL=botui-engine.js.map",
);
written.add(join(publicDir, "botui-engine.js"));
await writeFile(join(publicDir, "botui-engine.js"), engineSource, "utf8");
await emit(join(root, "packages/core/dist/index.js.map"), join(publicDir, "botui-engine.js.map"));
await emit(join(root, "packages/core/dist/botui-dot-matrix.css"), join(publicDir, "botui.css"));
await emit(join(site, "index.html"), join(dist, "index.html"));

const copyTree = async (from, to) => {
  await mkdir(to, { recursive: true });
  for (const entry of await readdir(from, { withFileTypes: true })) {
    const a = join(from, entry.name);
    const b = join(to, entry.name);
    if (entry.isDirectory()) await copyTree(a, b);
    else if (entry.isFile()) await emit(a, b);
  }
};
await copyTree(publicDir, dist);

// a tiny manifest, so a deploy can be checked against what the build believes it made
await writeFile(
  join(dist, "build-manifest.json"),
  `${JSON.stringify(
    {
      files: [...written].map((p) => relative(dist, p)).sort(),
      registry: "https://ui.botharness.ai",
    },
    null,
    2,
  )}\n`,
  "utf8",
);

process.stdout.write(`site: ${written.size} files → ${relative(root, dist)}\n`);
