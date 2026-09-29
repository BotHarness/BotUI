// @ts-check
import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import { paraglideVitePlugin } from "@inlang/paraglide-js";

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
      // Options are given EXPLICITLY here rather than left to
      // project.inlang/paraglide.config.js, because the CLI and the plugin must
      // produce identical output — a `pnpm paraglide compile` that disagrees with
      // `astro build` means the type declarations describe a different runtime
      // than the one that ships.
      paraglideVitePlugin({
        project: "./project.inlang",
        outdir: "./src/paraglide",
        emitTsDeclarations: true,
        // `globalVariable` must come before `baseLocale` so setLocale() can hold the
        // locale during a STATIC render — there is no browser to read a URL from
        strategy: ["url", "globalVariable", "baseLocale"],
        urlPatterns: [
          {
            pattern: "/:path(.*)?",
            localized: [
              ["en", "/:path(.*)?"],
              ["zh", "/zh/:path(.*)?"],
            ],
          },
        ],
      }),
    ],
  },
});
