# Changelog

All notable changes to BotUI are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the registry is versioned with the packages.

## [0.1.1] — 2026-09-30

### Added

- A README and full npm metadata for all three packages: `repository` (with the `directory`
  that lands the link on that package's subtree), `homepage`, `bugs` and `keywords`. The 0.1.0
  pages rendered with no body and no route back to the source.

### Changed

- **The playground opens on the CSS renderer**, as a switch on the stage beside the field it renders. It is the default because it costs zero JS per frame and SVG is the escape hatch for the motions CSS cannot express — so the field you see on arrival is the one most people will actually ship. The refusal note rides on the switch, so the reason a motion has no CSS form is where you would turn it on.
- **The picture cards scroll sideways instead of wrapping.** A wrapped grid grows taller as options are added, and the column it lives in is already taller than the viewport, so every extra shape pushed the sliders further down. A row costs the column nothing. `SHAPE` leads them, then `MOTION`, then `DOT SHAPE`.
- The playground opens at a denser dot/cell than the engine's default. At 55% a field reads as scattered pixels, and the page's subject is what a dot IS; the engine's own default is untouched, because that is the library's choice.
- The side column is not sticky again. Sticky on both columns made the sliders reachable but turned the whole right-hand side into a pane you had to scroll independently, which is worse than letting it travel with the page.

- **The playground's shape and motion controls are pictures now, not sliders.** `sides` and `silhouette` sat in one list under one "shape" heading, so a reader could not tell which moved the whole field and which moved each dot; the silhouette is now a card group whose cards change the field's outline and a second group whose cards change the dot inside it, each stating its scope in the same place. Presets were a `<select>` of bare names, which cannot convey that `spiral` and `ring` differ; they are cards that run the engine, and they animate once the pointer or focus reaches them rather than twelve at once.
- Every card draws the engine's own output — `field()` for a still, `cellsFor()` for a silhouette, the live field for a motion. A card that drew its own approximation of a dot would be a second implementation of the thing it advertises, and would drift the moment the glyph code changed. The phase is deliberately not 0: a traversal lives in the difference between cells, and at t=0 they are all at rest, so a still card showed a uniform blob.
- Rows and columns are steppers on the stage rather than sliders in the side column, and `dot/cell` moved onto the stage too: they are what you reach for while looking at the field. Overall `size` moved to last, because it decides how much room the field takes rather than what it looks like.

- `check-registry.mjs` now fails the build when a published package has no README, no
  `repository` pointing at this repo, no homepage or no bugs URL.

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
- **The site is bilingual.** English at `/` and Chinese at `/zh/`, from Paraglide message
  catalogs under `apps/site/messages/`, with a real link between them, per-page `hreflang`, and a
  `<html lang>` that matches the copy. The switch is a link to the other locale's file rather
  than a client-side toggle, so `/zh/` is reachable with JavaScript off and crawlable.
- `pnpm i18n` compiles the message catalogs. `apps/site/src/paraglide` is generated and
  gitignored, so `typecheck` and `verify` now run this first: from a clean clone they used to
  fail on imports that were not on disk yet.
- **Publishing to npm needed a token, and this account's 2FA is a passkey**, which the CLI cannot answer — WebAuthn needs a browser. `scripts/npm-token.sh` collects a granular access token, validates it against the registry, and stores it in `npm_release.token` (gitignored, mode 600); it re-prompts on its own once the token expires or is revoked. `release.mjs` reads that file and hands the token to npm through the child process's environment rather than an argv flag, because argv is readable through `ps` and command lines land in CI logs. A project `.npmrc` would have applied the token to every npm command in the repo, `npm install` included.
- **The three published packages had no README and no repository link**, so their npm pages rendered with no body and no way back to the source — indistinguishable from a package nobody should trust, with no URL to file an issue against. Each package now has a README written for its own audience and declares `repository` (with the `directory` that lands the link on its subtree), `homepage`, `bugs` and `keywords`. `check-registry.mjs` enforces all four, verified by deleting a README and a `repository` and watching the build fail.

### Fixed

- **Some motion cards could not be clicked, and one of them crashed the page.** Three separate causes, all invisible to `element.click()` and all found by dispatching real mouse coordinates through CDP:
  - The live preview bound `onPointerEnter` on a div **inside the card's `<label>`**. Moving the pointer onto a card started an animation, the re-render interrupted the label's click, and half the cards needed two or three presses. The preview is now `pointer-events: none` and nothing in it reacts to the pointer. Measured: **4 of 7** visible cards registered the first click before, **7 of 7** after.
  - `scroll-snap-type: x proximity` made the browser glide a card to the row's edge after the pointer left it, so a click landing during that glide hit where the card _was_. Removed: a pointer-driven scroller has no reason to move on its own.
  - `PRESETS.off` is `null` — no motion has no order or envelope — and the stagger control read `PRESETS[preset].spread`. Selecting `off` threw a TypeError, the render threw, and the card group stopped updating. The click was landing the whole time; the page was dying on it.

- **The card rows painted over the sticky stage.** `position: sticky` and `position: relative` are both positioned elements, and with `z-index: auto` on both the later one in the DOM wins — so `SHAPE`, its scope line and its cards landed on top of `dot/cell` and the stage looked like it had lost its own controls. The stage now carries an explicit layer, and the card group no longer needs one.
- A fade under the stage, so the rows read as passing behind it rather than being sliced through the middle by its edge. Content scrolling under a pinned element is what sticky is for; a card cut in half just reads as a rendering fault.

- **`softness`, `grow` and `floor` were on the page but could not be reached.** They sat below the fold of a side column holding 1001px of content in an 813px viewport, under a grid of picture cards, in a column with no visible bottom — "there is no way to adjust these" was a position bug, not a missing control. The side column is now sticky with its own scrollport, the picture cards moved beside the field they describe, and the three moved ahead of the geometric detail as their own group, because what a field _feels_ like is asked before how big it is. The readout moved below the playground: it is output, not input, and it was the cheapest 112px in the column.

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
- **The stagger dial was a one-way door.** Its default is the _preset's_ spread, so once
  dragged, `stagger` was a number forever: the label stopped saying "preset", switching the
  preset no longer moved the dial, and nothing on screen offered a way back. It now shows the
  preset's own number (`preset 95%`, so the label can never disagree with the thumb) and has a
  reset control that appears only when the value is an override.
- The slider audit now looks for a percentage _anywhere_ in a label rather than only at the
  start. Anchoring the match to the start meant the one slider whose default comes from a preset
  was the one slider the audit skipped — which is how a label reading only "preset" survived
  while its thumb sat at 95.
- **The Chinese page reverted to English the moment it finished loading.** The server-rendered
  markup was correct, because the SSG middleware sets the locale outright, but every island
  resolved its own copy from the URL — and the default locale's URL pattern was the catch-all
  `/:path(.*)?`, which also matches `/zh/` by reading "zh" as a path segment. Paraglide takes
  the first pattern that matches, so English won every URL. The default locale's pattern is now
  `/` exactly, and `apps/site/test/locale-resolution.test.tsx` renders the playground at both
  URLs and asserts copy that exists in only one catalog. The section headings could not have
  caught it: they are bilingual in both catalogs, so the page only _looked_ half translated.
- The Paraglide compiler options were written down twice — in `astro.config.mjs` and in
  `project.inlang/paraglide.config.js` — and the copies had already drifted, with the standalone
  config still placing English at `/en/` while Astro had been writing it to `/`. A
  `paraglide compile` run from the CLI would have generated a runtime that disagreed with the
  one that ships. Both now read `project.inlang/paraglide.options.js`.

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
