# AGENTS.md — BotUI

Open-source, copy-and-own UI components for agent products. Installed with `npx`, MIT licensed, published from
`ui.botharness.ai`. This file is the guidance for coding agents working in this repo.

## What this is

One component so far — `dot-matrix`, a loading field — and the machinery to ship more: a shadcn-compatible
registry, an installer CLI, a React wrapper, and a docs site that runs the real build.

The premise is **copy-and-own**. A user installs source files into their repo and owns them. That single decision
drives most of what follows.

## Commands

```bash
pnpm install
pnpm build        # packages → CSS → registry → the Astro site, in that order
pnpm verify       # i18n, format:check, lint, typecheck, test, registry:check
pnpm i18n          # paraglide compile — the site's generated, gitignored message code
pnpm site:dev     # astro dev
pnpm site:deploy  # wrangler pages deploy — Cloudflare Pages, project botui-site
```

Toolchain: pnpm 12.4.2 · Node ≥22 (`.node-version` = v24.21.0) · **TypeScript 7** · **Vite 8** ·
**React 19.3** · **Astro 7** · oxlint · oxfmt · vitest · tsdown · wrangler 4.

`ui.botharness.ai` is a **Cloudflare Pages** project (`botui-site`), serving the static Astro build plus the
generated registry. It is not a Worker: the site is `output: 'static'`, so the deploy is a file tree.

### What the typecheck does NOT cover

`astro check` does not support TypeScript 7 yet — it refuses, and asks for TypeScript 6. So **`.astro` files are
not typechecked**: a typo in a template expression is caught by `astro build` (which renders every page) or not
at all. `.tsx` and `.ts` under `apps/site/src` are covered by `tsc --noEmit -p apps/site`.

If Astro ships TS 7 support, wire `astro check` back in rather than leaving this note to drift.

## The rules that matter here

- **Never hand-edit generated output.** `apps/site/public/registry.json`, `apps/site/public/r/*.json`,
  `apps/site/dist/` and `packages/core/dist/botui-dot-matrix.css` are build artefacts and are not committed. The
  stylesheet in particular is generated from the same envelope functions the runtime uses, so a checked-in copy
  would be a second source of truth for the motion tables.
- **The site's stylesheets are one file each, and the component's comes from the package.** The layout imports
  `@botharness/botui-core/style.css`; there is no second copy in `apps/site`. An earlier hand-written build emitted
  the component stylesheet under the page stylesheet's name and overwrote the source, shipping a completely
  unstyled site with every check green — so a test now reads the built CSS bundle and fails if either set of rules
  has swallowed the other.
- **The registry is a projection of `packages/*`, not a manifest.** Add a component by adding a package and a
  table entry in `scripts/build-registry.mjs`. If a file has to be listed twice, the build is wrong.
- **Ship the source structure intact.** The modules import each other relatively, so the registry preserves the
  tree under `components/botui/`. Flattening it breaks every import in the user's build, not ours. The one rewrite
  the build performs is the React wrapper's `@botharness/botui-core` → `../botui/index.js`, and
  `scripts/check-registry.mjs` fails if any item still imports a package it does not declare.
- **One field, two renderers.** `field(options, t)` is the only place geometry is computed. A renderer that
  re-derives the layout is a second chance to disagree with the other one — which is how the two drifted apart on
  pitch in the first place. There is a test that samples the emitted CSS keyframes and checks them against the
  envelope numerically; keep it passing.
- **Preserve the size algebra.** `cell = size / ((n - 1)(1 + gap) + dotSize)` is solved, not clipped, which is what
  keeps the field landing exactly on the box at any `dotSize` — including above 1, where the dots touch. If you
  change it, the invariant tests in `packages/core/test/dot-matrix.test.ts` are the specification.
- **Verify layout in a browser, not in jsdom.** jsdom computes no layout at all — `getComputedStyle(el).gridTemplateColumns` on a real grid rule returns the empty string — so no unit test here can catch a box that has collapsed. A stage whose controls column was an `auto` track (sized by max-content) grew from 264px to 602px on a single long caption and squeezed the field's track to zero; the stage is `overflow: hidden`, so the field was clipped out of existence while the DOM still held all 25 cells and every source-level check passed. Drive Chrome over CDP (`--remote-debugging-port`, `Runtime.evaluate`, `Page.captureScreenshot`) with a **dedicated `--user-data-dir`** — reusing the default one makes the instance exit immediately — and assert on measured geometry and on screenshots. Regexing the stylesheet for the rule is not a substitute: a test written that way matched a different component's `repeat(auto-fill, …)` and stayed green with the bug present.
- **Direction is per-order AXES, not a global "reverse".** `direction` is a list of axis tokens
  (`["counterClockwise", "insideOut"]`), and each order reads only its own — `ORDER_DIRECTION_AXES` is the
  contract a UI reads to know what to offer. Offer from that table and never from a hardcoded list: a
  concentric ring has no winding (a Chebyshev distance is not a walk around a circle), so `clockwise` on it
  would be a control claiming something the engine cannot do. Reversal is `1 - o`, but reversing the VALUE
  does not reverse a winding, which is why the two are separate tokens rather than one `reverse` flag.
- **Comments explain why, and cite the trap.** The strongest comments in this repo record a bug that was found
  the hard way (a seam discontinuity at `p = 0`, a blur that dissolved the crest, a quantised order that no
  envelope could smooth). Keep that density; do not add comments that restate the code.

## Adding a component

Deliver it as a vertical slice, not a horizontal layer: the engine, the registry item, the CLI path, a live demo
on the site, and the tests that prove the copy a user receives is the code in this repo. A backend-only foundation
or a disconnected mock is preparatory work, not a finished component.

- The layer tables (`SILHOUETTES`, `ORDERS`, `ENVELOPES`, `DOT_SHAPES`, `PRESETS`) are the extension points. Prefer a
  new table entry over a new `if`.
- A new table entry must come with the invariant tests that make it trustworthy: a stop table that starts and ends
  at `rest`, an order defined on the real rectangle, a preset that names a real order and envelope.
- Naming: presets are named after MOTION and carry a `task` naming the agent state, because the caller should not
  have to translate from product language.

## Release

`CHANGELOG.md` and `CHANGELOG.zh.md` are the bilingual ledger, kept structurally aligned. A user-visible change, a
new component, or a release PR updates both.

```bash
bash scripts/npm-token.sh  # store the npm publish token (gitignored, mode 600)
pnpm release            # build + verify, then print what it would publish
pnpm release -- --yes   # publish core → react → cli, then deploy the registry
```

Publishing needs a granular npm token with _Read and write_ + _Bypass 2FA_; the account's
2FA is a passkey, which the CLI cannot answer. `scripts/npm-token.sh` collects and
validates it into `npm_release.token`, and `release.mjs` reads that file and passes the
token to npm through the child process's environment — never as an argv flag, which
`ps` and CI logs would expose. The script can confirm the token _authenticates_; nothing
short of a real publish can confirm it may _publish_, so `release.mjs` publishes `core`
first and a permission failure lands before anything is half-released.

Three things about that order are load-bearing:

- **The registry is deployed by hand after the publish**, not before. A user who runs
  `npx @botharness/botui add` gets files from `ui.botharness.ai`, not from npm, so an
  npm version that is live while its registry item is not would install nothing. The
  release script prints the deploy command for exactly this reason.
- **Packages publish in dependency order.** `@botharness/botui-react` depends on
  `@botharness/botui-core` as `workspace:*`, which pnpm rewrites to a real version on
  publish; the reverse order would put a resolvable-looking version on npm that depends
  on nothing.
- **The registry is never committed**, so a release cannot ship a stale one — there is
  nothing stale to ship.
