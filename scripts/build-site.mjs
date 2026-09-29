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

/**
 * The generated files staged into public/.
 *
 * public/ otherwise holds HAND-AUTHORED files, and the two must never share a name.
 * That is not hypothetical: an earlier version of this build emitted the component
 * stylesheet as public/botui.css, which was also the page stylesheet's name. The
 * build overwrote the source file, the site shipped with the component's rules at
 * /botui.css, and the page rendered completely unstyled — with every other check
 * green, because the file existed and the selector test had never been written.
 *
 * So the allowlist is the point, not the tidy naming: a generated file may only
 * claim a name on this list, and anything else fails the build.
 */
const GENERATED = new Set(["botui-engine.js", "botui-engine.js.map", "botui-dot-matrix.css"]);

async function emit(from, to) {
  if (written.has(to)) {
    throw new Error(
      `site: two artifacts want the same output path — ${relative(root, to)}.\n` +
        `      One of them would overwrite the other and the page would break in a way\n` +
        `      nothing else here would catch. Give them distinct names.`,
    );
  }
  const inPublic = to.startsWith(`${publicDir}/`);
  const name = inPublic ? to.slice(publicDir.length + 1) : null;
  if (inPublic && !GENERATED.has(name)) {
    throw new Error(
      `site: refusing to write a GENERATED file over hand-authored source — ${name}.\n` +
        `      Generated files staged into public/ must be listed in GENERATED in\n` +
        `      scripts/build-site.mjs. (An earlier build overwrote the page stylesheet\n` +
        `      this way and shipped an unstyled site.)`,
    );
  }
  written.add(to);
  await mkdir(dirname(to), { recursive: true });
  await copyFile(from, to);
}

/** stage a text artefact through the same allowlist as emit() */
async function stageText(to, text) {
  const name = to.slice(publicDir.length + 1);
  if (!GENERATED.has(name)) {
    throw new Error(`site: ${name} is not in GENERATED — refusing to stage it over source`);
  }
  written.add(to);
  await writeFile(to, text, "utf8");
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
await stageText(join(publicDir, "botui-engine.js"), engineSource);
await emit(join(root, "packages/core/dist/index.js.map"), join(publicDir, "botui-engine.js.map"));
// the COMPONENT stylesheet, under its own name. It is not the page stylesheet, and
// the demo's CSS-renderer toggle needs it: the runtime injects the @keyframes, but
// the .botui-dot-matrix layout rules live in this file.
await emit(
  join(root, "packages/core/dist/botui-dot-matrix.css"),
  join(publicDir, "botui-dot-matrix.css"),
);
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
