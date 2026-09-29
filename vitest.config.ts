import { defineConfig } from "vitest/config";

export default defineConfig({
  esbuild: { jsx: "automatic" },
  test: {
    include: [
      "packages/*/test/**/*.{test,spec}.{ts,tsx}",
      "apps/*/test/**/*.{test,spec}.{ts,tsx}",
      "scripts/**/*.test.ts",
    ],
    // Node everywhere by default. A suite that needs a DOM opts in with a
    // `@vitest-environment jsdom` docblock — vitest 4 removed
    // `environmentMatchGlobs`, and a glob that silently stops matching is a suite
    // that fails for the wrong reason.
    environment: "node",
  },
});
