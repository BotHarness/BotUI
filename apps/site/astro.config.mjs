// @ts-check
import { defineConfig } from "astro/config";
import react from "@astrojs/react";

/**
 * Static output, no adapter.
 *
 * The registry is JSON and the demos run in the browser, so there is nothing to
 * render per request — and `output: 'static'` means the deploy target is a plain
 * file tree, which is exactly what Cloudflare Pages wants. Adding SSR later is one
 * line: `@astrojs/cloudflare` plus `output: 'server'`, and the pages here do not
 * change.
 */
export default defineConfig({
  output: "static",
  integrations: [react()],
  build: {
    // the engine ships real source in the registry, so the demo inlining the built
    // bundle is not the same bytes — but it IS the same implementation, which is
    // the property that matters. Keeping it a separate chunk makes that visible in
    // the network panel instead of hidden in a bundle.
    assets: "assets",
  },
  vite: {
    // a warning here means the engine is being pulled into the SSR graph, where it
    // has no document to paint into
    ssr: { noExternal: ["@botharness/botui-core"] },
  },
});
