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
pnpm build      # packages → CSS → registry → site, in that order
pnpm verify     # format:check, lint, typecheck, test, registry:check
```

Toolchain: pnpm 12.4.2 · Node ≥22 (`.node-version` = v24.21.0) · TypeScript 5.9 · oxlint · oxfmt · vitest · tsdown.
Deploy the site with `wrangler deploy -c apps/site/wrangler.jsonc` (Worker `botui-site`, custom domain
`ui.botharness.ai`).

## The rules that matter here

- **Never hand-edit generated output.** `apps/site/public/registry.json`, `apps/site/public/r/*.json`,
  `apps/site/dist/` and `packages/core/dist/botui-dot-matrix.css` are build artefacts and are not committed. The
  stylesheet in particular is generated from the same envelope functions the runtime uses, so a checked-in copy
  would be a second source of truth for the motion tables.
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
new component, or a release PR updates both. The registry is versioned with the packages, and a release publishes
the rebuilt registry before the npm packages, so an `npx` install never resolves to a version that does not exist
yet.
