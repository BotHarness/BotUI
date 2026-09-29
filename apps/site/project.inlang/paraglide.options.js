/**
 * The Paraglide compiler options, in one place.
 *
 * `astro.config.mjs` and `paraglide.config.js` both need these, and they have to
 * agree: the plugin runs the compiler during `astro build`, the CLI runs it when
 * someone regenerates the types by hand, and a disagreement means the emitted
 * `.d.ts` files describe a runtime other than the one that ships. That is not
 * hypothetical — the two copies drifted once already, with the standalone config
 * still claiming English lived at `/en/` while Astro had been writing it to `/`.
 * A shared module makes the second copy impossible to write.
 *
 * `strategy` order matters: `globalVariable` has to come before `baseLocale` so
 * `setLocale()` can hold the locale during a STATIC render. With no browser there is
 * nothing to read `window.location` from, and the SSG middleware sets the locale
 * explicitly before each page renders.
 *
 * The patterns are URL-prefixed, which SSG requires: `/` and `/zh/` have to be two
 * different files on disk, so there is no such thing as "the same path, two
 * languages" without a request to vary on. This also has to agree with
 * `i18n.routing` in `astro.config.mjs`, or the language switcher links to a file
 * that was never generated — a 404 only a human clicking it finds.
 * @typedef {import("@inlang/paraglide-js").CompilerOptions} CompilerOptions
 */

export const strategy = /** @type {CompilerOptions["strategy"]} */ ([
  "url",
  "globalVariable",
  "baseLocale",
]);

/**
 * One document per locale, so the patterns are exact.
 *
 * The default locale's pattern is `/`, never a catch-all. Paraglide walks
 * `localized` in order and takes the first pattern that matches, so `/:path(.*)?` for
 * `en` also matches `/zh/` — it captures the "zh" as a path segment — and English
 * then wins every URL. That failure is invisible on the server, where the middleware
 * calls `setLocale()` outright, and appears only after hydration, when every island
 * flips back to English on the Chinese page while the markup around it stays
 * Chinese. `test/locale-resolution.test.tsx` is what notices if a page is added here
 * and forgotten.
 */
export const urlPatterns = /** @type {NonNullable<CompilerOptions["urlPatterns"]>} */ ([
  {
    pattern: "/:path(.*)?",
    localized: [
      ["en", "/"],
      ["zh", "/zh/"],
    ],
  },
]);

export const emitTsDeclarations = /** @type {CompilerOptions["emitTsDeclarations"]} */ (true);
