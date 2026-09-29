import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.tsx"],
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: true,
  external: ["react", "react-dom", "@botharness/botui-core"],
  outExtensions: () => ({ js: ".js", dts: ".d.ts" }),
});
