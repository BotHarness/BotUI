# Changelog

All notable changes to BotUI are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the registry is versioned with the packages.

## [Unreleased]

### Changed

- **The site is now Astro + React islands on Cloudflare Pages.** `apps/site` was a hand-written HTML page with a
  module script, served from a Worker with static assets; it is now `output: 'static'` Astro 7 with React 19.3
  islands built by Vite, deployed to the `botui-site` Pages project. The demos mount
  `@botharness/botui-core` directly rather than through the published React wrapper, so the site cannot inherit a
  fix and report the component works.
- Toolchain moved to TypeScript 7, Vite 8, React 19.3 and Astro 7. TS 7 removed `baseUrl`, so `paths` in
  `tsconfig.base.json` are now explicitly `./`-prefixed.

### Added

- The site opens on the playground, directly under the install command. It is the page's
  subject, so making you scroll past a component index to reach it was a detour; the island is
  `client:load` rather than `client:visible` so it is interactive on arrival.
- Playground controls, grouped: **shape** (silhouette, dot `sides`, dot preset, radius, aspect),
  **size** (px, cols, rows, dot/cell, gap x, gap y) and **motion** (preset, **speed**, stagger,
  softness, grow, floor). Speed was missing entirely, which made the demo a GIF you could not slow
  down.
- The two shapes are **sliders**, not dropdowns. A dot is a polygon plus two radii, so `sides` is the
  honest control and dragging it is how you find out that a 7-gon is a heptagon. The named glyphs
  stay as a second control for what `sides` cannot reach — a star is a notch _between_ the points.
- `cssRenderable()` / `cssRenderGap()` exported from the engine, so a caller asks the component
  whether the CSS renderer can express a motion instead of re-implementing the rule. The playground
  was checking whether a preset _exists_, so the checkbox stayed enabled for `columns` — a motion a
  per-dot delay cannot express.
- `apps/site/test/playground.test.tsx` drives the real controls: ten tests that dispatch input events
  and assert the field changed. A slider that renders and does nothing is indistinguishable from one
  that works, in a screenshot and in a DOM dump.

## [0.1.0] — 2026-09-30

### Added

- **`dot-matrix`** — a loading field as five replaceable layers: lattice/silhouette,
  traversal order, brightness envelope, dot polygon, renderer. Two renderers (SVG
  per-frame, CSS `@keyframes` at zero JS per frame) driven by one `field(options, t)`,
  so they cannot disagree.
- **`dot-matrix-react`** — the `<DotMatrix>` wrapper, with `state="thinking"` mapping an
  agent state to a motion.
- A shadcn-compatible registry at `https://ui.botharness.ai`, so
  `npx shadcn@latest add https://ui.botharness.ai/r/dot-matrix.json` installs the same
  components as `npx @botharness/botui add dot-matrix`.
- `@botharness/botui` — the installer, with `add` / `list` / `info`, `--dry-run`,
  `--force` and conflict reporting.
- A docs site on `ui.botharness.ai` running the built engine, not a copy of it.

### Fixed

- The docs site shipped with **no page styles**. `build-site.mjs` emitted the component
  stylesheet as `apps/site/public/botui.css`, which was also the page stylesheet's name, so
  the build overwrote the source file and the site served the component's three rules in place
  of the page's. Every check passed, because the file existed and nothing asserted what was in
  it. The page stylesheet is now `site.css`, the component stylesheet ships as
  `botui-dot-matrix.css`, and the build refuses to write a generated file over a hand-authored
  one — with a test that reads the served CSS and fails if it is the wrong file.

[Unreleased]: https://github.com/BotHarness/BotUI/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/BotHarness/BotUI/releases/tag/v0.1.0
