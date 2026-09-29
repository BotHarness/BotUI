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
pnpm verify       # format:check, lint, typecheck, test, registry:check
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
pnpm release            # build + verify, then print what it would publish
pnpm release -- --yes   # publish core → react → cli, then deploy the registry
```

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
