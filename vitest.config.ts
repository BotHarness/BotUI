import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/*/test/**/*.test.ts", "scripts/**/*.test.ts"],
    environment: "node",
    environmentMatchGlobs: [["packages/core/test/dom.test.ts", "jsdom"]],
  },
});
