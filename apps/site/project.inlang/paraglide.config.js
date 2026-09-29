/**
 * Paraglide compiler options, read from here by the CLI and by every bundler plugin.
 *
 * `strategy` order matters: `globalVariable` has to come before `baseLocale` so
 * `setLocale()` can hold the locale during a STATIC render. With no browser there is
 * nothing to read `window.location` from, and the SSG middleware sets the locale
 * explicitly before each page renders.
 *
 * Every locale is URL-prefixed, which SSG requires: `/en/` and `/zh/` have to be two
 * different files on disk, so there is no such thing as "the same path, two languages"
 * without a request to vary on.
 */
export default {
  outdir: "./src/paraglide",
  emitTsDeclarations: true,
  strategy: ["url", "globalVariable", "baseLocale"],
  urlPatterns: [
    {
      pattern: "/:path(.*)?",
      localized: [
        ["en", "/en/:path(.*)?"],
        ["zh", "/zh/:path(.*)?"],
      ],
    },
  ],
};
