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

### Fixed

- **Three playground sliders were broken in the same way, and none of the tests could see
  it.** `radius`, `aspect` and `speed` passed the raw 0…1 option against a track measured in
  hundredths. Radius `0.7` on a `0…90` track put the thumb at 0.8% of the travel, which is why
  it felt stuck; `speed` 1 on a `5…300` track and `aspect` 1 on a `20…100` track were both
  silently clamped to their minimum by the browser, which is why they felt inert. The ×100 now
  lives in one `PercentSlider` component, so no call site can get the scale wrong.
- The radius slider's top end is now the polygon's own inradius, so dragging it all the way
  always produces a circle — for a triangle (50%), a square (71%) and a pentagon (81%) alike. A
  fixed 90% was unreachable for some shapes and meaningless for others.
- Two audits in `apps/site/test/playground.test.tsx` compare each slider's thumb against the
  number printed beside it, and its requested value against its declared range. Both were
  verified by reintroducing the defect.

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
