import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: true,
  // the package is type: module, so the ESM output is plain .js — the .mjs
  // extension tsdown picks by default would force every consumer's import map to
  // name a file extension the package does not otherwise use
  outExtensions: () => ({ js: ".js", dts: ".d.ts" }),
});
