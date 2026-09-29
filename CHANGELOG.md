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
