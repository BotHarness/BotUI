/**
 * The compiler options for a standalone `paraglide compile`.
 *
 * They live in `paraglide.options.js` because `astro.config.mjs` compiles with the
 * same ones — see that file for why they must not be written twice.
 */
import { emitTsDeclarations, strategy, urlPatterns } from "./paraglide.options.js";

export default {
  outdir: "./src/paraglide",
  emitTsDeclarations,
  strategy,
  urlPatterns,
};
