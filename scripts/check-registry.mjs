#!/usr/bin/env node
/**
 * Check the built registry.
 *
 * The registry is what other people install, so the failure mode we care about is
 * "it published something subtly wrong and nobody noticed until a user's build broke".
 * These are the checks that catch that class:
 *
 *   · the shape shadcn's schema requires (name, type, files with path+content)
 *   · every shipped file's imports resolve to another file in the SAME item, or to a
 *     dependency the item declares — a component that imports a package nobody
 *     installs is the classic copy-and-own failure
 *   · the stylesheet is present and actually contains keyframes
 *   · every registryDependency names an item that exists
 *   · no item ships a file outside components/ (a stray absolute path would write
 *     outside the user's project)
 *
 * Run with --strict in CI; without it, warnings are reported but do not fail.
 */
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "apps", "site", "public");
const strict = process.argv.includes("--strict");

const problems = [];
const warnings = [];
const fail = (m) => problems.push(m);
const warn = (m) => warnings.push(m);

const builtins = new Set([
  "node:fs",
  "node:path",
  "node:url",
  "fs",
  "path",
  "url",
  "os",
  "crypto",
  "util",
  "events",
  "stream",
  "readline",
  "child_process",
  "http",
  "https",
  "net",
  "tty",
  "zlib",
  "assert",
  "buffer",
  "process",
]);

function isNodeBuiltin(spec) {
  return builtins.has(spec) || builtins.has(packageOf(spec));
}

/** react and friends are peers of the host app, not something the item installs */
function isPeerish(spec) {
  return ["react", "react-dom", "react/jsx-runtime"].includes(spec);
}

const FILE_TYPES = new Set([
  "registry:lib",
  "registry:block",
  "registry:component",
  "registry:ui",
  "registry:hook",
  "registry:theme",
  "registry:page",
  "registry:file",
  "registry:style",
  "registry:base",
  "registry:item",
]);

const registryPath = join(out, "registry.json");
if (!existsSync(registryPath)) {
  fail(`no registry at ${registryPath} — run \`pnpm registry:build\``);
  report();
}

const registry = JSON.parse(await readFile(registryPath, "utf8"));

/* ---- the published packages ----
 *
 * These three are published to npm, and a package page is assembled from the
 * manifest: `repository` is what links the package back to its source, and the
 * README is the entire body of that page. A missing `repository` renders as a
 * package with no visible source link, which is indistinguishable from a package
 * nobody should trust — and nobody can file an issue at a repository the manifest
 * does not name.
 *
 * `homepage` is checked for the same reason: the docs ARE the reference for an
 * options-heavy component, and npmjs.com gives the field its own prominent slot.
 */
const REPO_URL = "https://github.com/BotHarness/BotUI";
for (const dir of ["core", "react", "cli"]) {
  const manifestPath = join(root, "packages", dir, "package.json");
  if (!existsSync(manifestPath)) continue;
  const m = JSON.parse(await readFile(manifestPath, "utf8"));
  const where = m.name ?? `packages/${dir}`;

  if (!m.repository?.url) {
    fail(`${where}: no repository.url — the npm page will have no source link`);
  } else if (!m.repository.url.includes("github.com/BotHarness/BotUI")) {
    // A repository pointing somewhere other than this repo means the published
    // source and the installed source have diverged.
    fail(`${where}: repository.url points outside ${REPO_URL} (${m.repository.url})`);
  } else if (m.repository.directory !== `packages/${dir}` && dir !== "cli") {
    // The `directory` is what makes the link land on this package's subtree
    // instead of the repo root. Worth one line so it cannot rot unnoticed.
    warn(`${where}: repository.directory is ${m.repository.directory ?? "(unset)"}`);
  }

  if (!m.homepage) fail(`${where}: no homepage`);
  if (!m.bugs?.url) fail(`${where}: no bugs.url`);
  if (!existsSync(join(root, "packages", dir, "README.md"))) {
    fail(`${where}: no README.md — the npm page would render with no content`);
  }
}

/* ---- the root document ---- */
if (registry.$schema !== "https://ui.shadcn.com/schema/registry.json") {
  fail(`root $schema should be shadcn's registry schema, got ${registry.$schema}`);
}
if (!registry.name) fail("the root registry needs a name");
if (!registry.homepage) fail("the root registry needs a homepage");
if (!Array.isArray(registry.items) || registry.items.length === 0)
  fail("the root registry has no items");

/* ---- the items ---- */
const names = new Set();
const byName = new Map();
for (const item of registry.items ?? []) if (item.name) byName.set(item.name, item);

/**
 * Every file an item ends up with, following its registryDependencies — which is
 * what the installer actually writes. A relative import may legitimately reach into
 * a dependency's files, so a per-item view would report false failures.
 */
function closureOf(item, seen = new Set()) {
  if (seen.has(item.name)) return new Set();
  seen.add(item.name);
  const paths = new Set(item.files.map((f) => f.path));
  for (const dep of item.registryDependencies ?? []) {
    const next = byName.get(dep);
    if (next) for (const p of closureOf(next, seen)) paths.add(p);
  }
  return paths;
}
for (const item of registry.items ?? []) {
  const where = `item "${item.name ?? "(unnamed)"}"`;
  if (!item.name) fail(`${where}: name is required`);
  if (names.has(item.name)) fail(`${where}: duplicate name`);
  names.add(item.name);
  if (!item.type) fail(`${where}: type is required`);
  if (!item.description) warn(`${where}: no description — the picker will show a blank row`);
  if (!Array.isArray(item.files) || item.files.length === 0) {
    fail(`${where}: no files — an item with nothing to install is not installable`);
    continue;
  }

  const shipped = closureOf(item);
  const targets = new Set();

  for (const file of item.files) {
    if (!file.path) fail(`${where}: a file has no path`);
    if (typeof file.content !== "string" || file.content.length === 0) {
      fail(`${where}: ${file.path} has no content`);
    }
    if (file.type && !FILE_TYPES.has(file.type))
      fail(`${where}: ${file.path} has an unknown type ${file.type}`);
    if (!file.target) warn(`${where}: ${file.path} has no target`);
    if (file.target) {
      if (targets.has(file.target)) fail(`${where}: two files claim the target ${file.target}`);
      targets.add(file.target);
      if (file.target.startsWith("/") || file.target.includes("..")) {
        // a stray absolute or climbing path would write outside the user's project
        fail(`${where}: target ${file.target} escapes the project`);
      }
    }
    if (file.content.includes("\t") && file.path.endsWith(".json")) {
      warn(`${where}: ${file.path} contains tabs`);
    }
  }

  // every import must resolve inside the item, or to a declared dependency
  const declared = new Set([...(item.dependencies ?? []), ...(item.devDependencies ?? [])]);
  for (const file of item.files) {
    if (!/\.(ts|tsx)$/.test(file.path)) continue;
    for (const spec of importsOf(file.content)) {
      if (spec.startsWith(".")) {
        // relative: must resolve to another file in the item or its dependencies.
        // TypeScript's NodeNext resolution is the rule — a source file imports
        // "./layout.js" while the file on disk is layout.ts — so both spellings are
        // accepted, and a bare directory import (an index) resolves to its index.
        const dir = file.path.slice(0, file.path.lastIndexOf("/"));
        const resolved = normalize(join(dir, spec));
        const candidates = [
          resolved,
          resolved.replace(/\.js$/, ".ts"),
          resolved.replace(/\.js$/, ".tsx"),
        ];
        const bare = resolved.replace(/\.js$/, "");
        if (bare !== resolved) candidates.push(`${bare}/index.ts`, `${bare}/index.tsx`);
        if (!candidates.some((c) => shipped.has(c))) {
          fail(
            `${where}: ${file.path} imports "${spec}", which resolves to none of ` +
              `${candidates.join(", ")} — the item does not ship it`,
          );
        }
      } else if (!declared.has(packageOf(spec)) && !isNodeBuiltin(spec) && !isPeerish(spec)) {
        fail(`${where}: ${file.path} imports "${spec}" but the item declares no such dependency`);
      }
    }
  }

  // the stylesheet has to be real, not an empty placeholder
  const css = item.files.find((f) => f.path.endsWith(".css"));
  if (item.name === "dot-matrix") {
    if (!css) fail(`${where}: the engine ships no stylesheet`);
    else if (!css.content.includes("@keyframes"))
      fail(`${where}: the stylesheet has no @keyframes`);
  }
}

/* ---- cross-item references ---- */
for (const item of registry.items ?? []) {
  for (const dep of item.registryDependencies ?? []) {
    if (!names.has(dep)) {
      fail(
        `item "${item.name}" registry-depends on "${dep}", which this registry does not contain`,
      );
    }
  }
}

/* ---- and the per-item documents the URLs serve ---- */
for (const item of registry.items ?? []) {
  if (!item.name) continue;
  const p = join(out, "r", `${item.name}.json`);
  if (!existsSync(p)) {
    fail(`r/${item.name}.json is missing — the CLI and \`shadcn add\` fetch items by URL`);
    continue;
  }
  const served = JSON.parse(await readFile(p, "utf8"));
  if (JSON.stringify(served) !== JSON.stringify(item)) {
    fail(`r/${item.name}.json does not match the item in registry.json — one of them is stale`);
  }
}

report();

function report() {
  for (const w of warnings) process.stdout.write(`warn  ${w}\n`);
  for (const p of problems) process.stdout.write(`FAIL  ${p}\n`);
  const total = problems.length + warnings.length;
  if (problems.length === 0) {
    process.stdout.write(
      `registry ok: ${registry.items?.length ?? 0} items, ${warnings.length} warning(s)${total ? "" : ""}\n`,
    );
  } else {
    process.stdout.write(`registry: ${problems.length} problem(s)\n`);
  }
  if (problems.length && strict) process.exit(1);
  if (problems.length) process.exit(1);
}

function importsOf(source) {
  const specs = [];
  const re = /(?:^|\n)\s*(?:import|export)[\s\S]*?from\s+['"]([^'"]+)['"]/g;
  const bare = /(?:^|\n)\s*import\s+['"]([^'"]+)['"]/g;
  for (const m of source.matchAll(re)) specs.push(m[1]);
  for (const m of source.matchAll(bare)) specs.push(m[1]);
  return [...new Set(specs)];
}

function packageOf(spec) {
  const parts = spec.split("/");
  return spec.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0];
}

function normalize(p) {
  const parts = [];
  for (const part of p.split("/")) {
    if (part === "." || part === "") continue;
    if (part === "..") parts.pop();
    else parts.push(part);
  }
  return parts.join("/");
}
