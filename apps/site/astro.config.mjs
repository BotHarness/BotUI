// @ts-check
import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import { paraglideVitePlugin } from "@inlang/paraglide-js";
import * as paraglideOptions from "./project.inlang/paraglide.options.js";

/**
 * Static output, no adapter.
 *
 * The registry is JSON and the demos run in the browser, so there is nothing to
 * render per request — and `output: 'static'` means the deploy target is a plain
 * file tree, which is exactly what Cloudflare Pages wants. Adding SSR later is one
 * line: `@astrojs/cloudflare` plus `output: 'server'`, and the pages do not change.
 *
 * `i18n.locales` MUST match `project.inlang/settings.json`. Astro's i18n is what
 * gives the middleware a `currentLocale` during a static render — with no request,
 * something has to tell Paraglide which language it is building.
 */
export default defineConfig({
  output: "static",
  integrations: [react()],
  i18n: {
    defaultLocale: "en",
    locales: ["en", "zh"],
    // every locale is prefixed, because SSG needs one file per locale: `/en/` and
    // `/zh/` are different files on disk, not one file that varies by request
    // English is NOT prefixed: `/` is English and `/zh/` is Chinese. Astro demands a
    // root index page whenever prefixDefaultLocale is on, and paying a redirect hop on
    // the URL people share and bookmark is a worse trade than one shared page body.
    routing: { prefixDefaultLocale: false, redirectToDefaultLocale: false },
  },
  build: { assets: "assets" },
  vite: {
    ssr: { noExternal: ["@botharness/botui-core"] },
    plugins: [
      // Options come from project.inlang/paraglide.options.js, which the standalone
      // CLI compile reads too, so the plugin and `pnpm --filter botui-site
      // i18n:compile` cannot produce two different runtimes. Only `outdir` is spelled
      // out here: it is a path relative to the bundler's CWD, not to the project.
      paraglideVitePlugin({
        project: "./project.inlang",
        outdir: "./src/paraglide",
        ...paraglideOptions,
      }),
    ],
  },
});
