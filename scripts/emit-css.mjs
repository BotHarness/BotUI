#!/usr/bin/env node
/**
 * Write the components' stylesheets as real .css files, out of the same functions
 * the runtime uses.
 *
 * A checked-in copy of this CSS would be a second source of truth for the
 * envelopes, and it would drift the first time a stop table changed. Generating it
 * from `stylesheet()` means the shipped file and the runtime keyframes are the same
 * text by construction.
 */
import { writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const pkg = join(here, "..", "packages", "core");
const { stylesheet } = await import(join(pkg, "dist", "index.js"));

const out = join(pkg, "dist", "botui-dot-matrix.css");
await mkdir(dirname(out), { recursive: true });
await writeFile(out, stylesheet(0), "utf8");
process.stdout.write(`emit-css: ${out}\n`);
