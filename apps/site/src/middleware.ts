import { defineMiddleware } from "astro:middleware";
import { assertIsLocale, baseLocale, setLocale } from "./paraglide/runtime.js";

/**
 * Tell Paraglide which language it is building.
 *
 * In SSR the Paraglide middleware reads the locale off the incoming request. In SSG
 * there IS no request — the runtime cannot read `window.location` because there is no
 * browser — so the locale has to be set explicitly before each page renders. Astro's
 * own i18n supplies `currentLocale`, which is why `i18n.locales` in astro.config.mjs
 * has to match `project.inlang/settings.json`: a locale Astro knows and Paraglide does
 * not (or the reverse) is a page that renders in the wrong language with no error.
 *
 * Note this is `setLocale`, NOT `paraglideMiddleware`: the Paraglide server
 * middleware de-localizes request URLs for SSR, while static pages need Astro to render
 * each localized path directly.
 */
export const onRequest = defineMiddleware((context, next) => {
  setLocale(assertIsLocale(context.currentLocale ?? baseLocale));
  return next();
});
