import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts", "src/registry.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  // the CLI is a program, not a library: nothing imports it
  shims: false,
  outExtensions: () => ({ js: ".js", dts: ".d.ts" }),
});
