# Changelog

## [Unreleased]

### Changed

- **Every motion can now be told which way to go.** `direction` is a list of axis tokens — `leftToRight`, `topToBottom`, `clockwise`, `outsideIn` and their opposites — and a spiral winds _and_ chooses an end, so `direction={["counterClockwise", "insideOut"]}` is one motion rather than two presets. It is a **list** because a row-major snake has two independent axes: which end of the first row leads, and whether the rows run top to bottom. Its four corners are four distinct drawings, and a single `reverse` flag could only ever reach two of them. The token names are relative to the motion rather than the screen, which is why `bottomToTop` flips a column-snake's travel but reverses a row-snake's rows.
- **Each traversal is offered only the directions it can honour.** A spiral gets a winding and a radius; a ring gets a radius and **no winding**, because a Chebyshev distance is not a walk around a circle — a `clockwise` card there would be a control claiming something the engine cannot do. `ORDER_DIRECTION_AXES` is the table a UI reads, so a control and the engine cannot disagree about what exists.
- **The CSS renderer needed no work.** It hands the motion to the browser as a per-cell `--botui-o` and a negative `animation-delay`, so re-ranking the traversal re-ranks the whole field. There is a test asserting that, because the claim is load-bearing: if a reversal ever needed its own keyframes, it would fail there rather than as a field that quietly runs the wrong way.

- **The copy button moved to the bottom of the field, and became the page's only primary action.** It was in the sidebar, where it read as one more control among forty. But you tuned _the field_, so the button that takes the tuning away belongs to the field: it now sits inside the sticky stage, spanning both columns, full width, in the accent colour. Everything else on this page exists to help you arrive at a setting; this is the one that lets you leave with it, and it should look like the difference. `var(--accent)` rather than a hex, so dark mode and any future theme follow — and the focus ring is offset, because the button _is_ the accent and an accent outline against an accent fill is invisible.

- **The playground can hand you its own settings.** A copy button next to the readout copies the install command, the `<DotMatrix>` element with the settings you arrived at already in it, and the stylesheet import — so the paste needs nothing else, and neither do you. It is a prompt rather than a component alone because a component with no way to install it is half an instruction. **Only the options you changed are emitted**, because a snippet carrying `fill={1} peak={1} floor={0.16}` on every copy says nothing about what you chose and goes stale when a default moves; touch nothing and you get `<DotMatrix />`, and the names are the real props — a snippet that looks right and does not compile is the same failure as a card redrawing its own dots. The description beside the motion is read out of the engine's own preset table, so it cannot drift from the card. Falls back to selectable text when the clipboard is refused, rather than a button that silently does nothing.

- **The playground now opens on a hand-picked showcase state** rather than the engine's defaults: 5×5 with no gap at the largest size, `dot/cell` at 198% so the dots overlap into one surface, `grow` at 3% so a dot moves rather than pulses, `stagger` pinned at 70% so picking another motion does not move a slider under the visitor, square silhouette and square dots at radius 0. The engine's own defaults are untouched — that is the library's choice and the page is allowed to disagree — so the values live in a named `SHOWCASE` beside the component, each with the reason it was picked.

- **The site is now Astro + React islands on Cloudflare Pages.** `apps/site` was a hand-written HTML page with a
  module script, served from a Worker with static assets; it is now `output: 'static'` Astro 7 with React 19.3
  islands built by Vite, deployed to the `botui-site` Pages project. The demos mount
  `@botharness/botui-core` directly rather than through the published React wrapper, so the site cannot inherit a
  fix and report the component works.
- Toolchain moved to TypeScript 7, Vite 8, React 19.3 and Astro 7. TS 7 removed `baseUrl`, so `paths` in
  `tsconfig.base.json` are now explicitly `./`-prefixed.

### Added

- **The dot colour is selectable, and it copies.** A picker in the sticky pane beside the field it colours — a native swatch with the OS colour well and the eyedropper, a text field, and HEX / RGB / HSL chips. The colour reaches the copied snippet, which it did not before: `changedOptions` never emitted `color`, so a visitor who picked a colour and pasted the result got a component that drew in `currentColor` and no indication why.
- **The notation chips are a VIEW, never an edit.** hsl is quantised — `#2f5bff` is `hsl(227 100% 59%)`, and that spelled back out is `#2d5bff` — so a chip that rewrote the value would shift the swatch by a couple of 255ths on every click and twice would be visibly a different colour. Clicking a chip changes only how the value is shown. A test clicks every chip twice and requires the original hex back.
- **Commits are coalesced into one frame.** A colour input fires `input` on every pointer move, far more often than the screen refreshes, and each event would re-render the playground and repaint the field. One write per frame is what makes dragging feel like the thing under your finger is the thing on screen. Getting there found a bug worth naming: the pending colour was held in a ref that was **also assigned on every render**, so the parent's stale value wiped the choice before the frame fired and the picker snapped back. A render is not consent to overwrite.
- **`currentColor` is resolved against the picker, not the document.** It has no pixel value of its own, and the swatch resolved it against `<body>`, which sets no colour — so the swatch showed black for dots that were not black. A swatch that reports the wrong colour is worse than no swatch. A value the picker genuinely cannot edit (`var(--brand)`, `color-mix(...)`) is now passed through untouched and **says so**, rather than being mangled.
- **The generated JSX is now checked by the repo's own compiler.** A new test hands the snippet to `tsc` and requires no syntax error. The TypeScript 7 runtime package exports no compiler API, so this shells out to the same binary `pnpm typecheck` runs — the snippet is validated by the toolchain that will compile it, not by a stand-in. It catches what a brace-balance check cannot, and it was verified to fail when the generator is broken.

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

- **Fixed: `Column Drop` still showed nothing, and this time the field was being clipped rather than missing.** The previous fix made the motion render, and it _was_ rendering — 25 cells, animating, one column lit at a time. The stage's controls column was an `auto` track, and `auto` is sized by max-content, so the refusal caption ("this motion is a highlight moving down the field…", shown only when the CSS renderer refuses the chosen motion) grew that track from **264px to 602px** and squeezed the field's own track to **zero**. The stage is `overflow: hidden`, so the field was not squashed — it was clipped out of existence. The tracks are capped now, and the caption wraps inside the cap instead of widening it.
- **This one has no automated test, on purpose.** jsdom computes no layout, so no test in this repo can catch a collapsed track, and the first attempt at one was worse than nothing: it regexed the stylesheet, matched a **different** component's `repeat(auto-fill, …)`, and stayed green with the bug present. A test that asserts about the wrong rule is not a slow test, it is a wrong one. `AGENTS.md` now records that this class of check needs a real browser over CDP, with the `--user-data-dir` detail that cost the most time to work out.

- **Fixed: picking `Column Drop` left the field blank.** A motion the CSS renderer cannot express — one that MOVES a highlight down a column, which a per-dot `animation-delay` cannot do — was still being rendered through it, and `buildCss` returns null for exactly those. The playground disabled the CSS switch and said so, then passed `renderer="css"` anyway, so the stage came up **empty**. Disabling a control without honouring it is the worst of both answers: the switch explains itself while the field shows nothing. The field now renders the one way it can, and the readout and the copied snippet say `svg` rather than claiming a mode the engine is not in. The engine normalises the same thing for direct callers, so `handle.options.renderer` reports what is actually painted instead of leaving the element empty.
- **The CSS renderer no longer publishes keyframes it cannot honour.** It emitted `@keyframes botui-dm-columns`, and that rule animated _nothing_: `spike` is a gaussian centred on the cycle seam, so sampling it at the two positions its stop table names — 0 and 1 — yields full brightness at both ends, i.e. a static fully-lit field. Shipping that in every consumer's stylesheet was a lie about what the motion looks like, not merely dead weight. Only presets the renderer actually accepts get a rule, which is the same rule `buildCss` applies.

- **Fixed: `direction` reached the state but not the CSS-rendered field.** Setting a direction updated the page and the copied snippet, and the field kept running the old way. The cause was not state management: a cell's traversal offset is written into its **inline style** when the CSS host is built, and `applyCssVars` only ever wrote the host's own variables — size, grid tracks, fill — so nothing could re-rank the cells. Direction was the first option to change the RANKING rather than a size, which is why the silhouette and the dials reached the CSS renderer and this did not. Changing `--botui-o` in place fixes it and, unlike replacing the DOM, does not restart the animations. `applyCssVars` now also reports whether the host still holds the cells these options call for, because a different lattice or silhouette is not patchable and was silently left stale for the same reason.
- **The test that should have caught it did not exist.** Every direction test forced the SVG renderer, where the field is a pure function of `(options, t)` and repaints every frame — so the SVG path passed while the site's **default** renderer stayed broken. There is now a test that stays on CSS, plus one that walks the live component rather than building a fresh host each time. The address a cell is matched by is now `data-cell` rather than a read-back of `grid-area`: the shorthand round-trips through the CSS parser, and the `grid-row-start` longhands it decomposes into are not implemented everywhere jsdom runs, which made the sync check report "rebuild" on every single update in a test DOM.

- **`chasing` had no gradient — it was three shelves, not a wave.** `chase` carried `steps: 3`, so the whole motion had exactly three brightness values (0.16, 0.58, 1.00) and every cell crossing a shelf jumped. Measured across a cycle, `chase` had **3** distinct brightness levels where `comet` had **78**. With `spread: 0.34` around a ring, several cells crossed a shelf in the same frame, which is what read as unsmooth. It is now a stop table with a fast rise and a six-stop decay: **173** levels, and the largest step between neighbouring samples fell from ~0.42 to **0.03**. The trailing lit tail behind the crest is new, and `chasing` now reads like the comet it always looked like it should be.
- The `steps` mechanism is gone with it: the `steps?: number` field on `Envelope`, the `level()` branch that read it, the `data-timing="steps-N"` switch in `field.ts`, and the `steps(3, end)` rule in the stylesheet. `chase` was the only envelope that used it, so all four were a description of a deleted behaviour — the exact kind of dead code this repo's own rules call out. Every envelope is one shape again: a stop table or a gaussian.

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

All notable changes to BotUI are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the registry is versioned with the packages.

## [0.1.2] — 2026-09-30

### Fixed

- **`chasing` had no gradient — it was three shelves, not a wave.** `chase` carried `steps: 3`, so the whole motion had exactly three brightness values (0.16, 0.58, 1.00) and every cell crossing a shelf jumped. Measured across a cycle, `chase` had **3** distinct brightness levels where `comet` had **78**. With `spread: 0.34` around a ring, several cells crossed a shelf in the same frame, which is what read as unsmooth. It is now a stop table with a fast rise and a six-stop decay: **173** levels, and the largest step between neighbouring samples fell from ~0.42 to **0.03**. The trailing lit tail behind the crest is new.

### Removed

- **`Envelope.steps`.** With `chase` no longer quantised, nothing read it: the field on `Envelope`, the `level()` branch, the `data-timing="steps-N"` switch, and the `steps(3, end)` CSS rule were all describing a behaviour that no longer existed. **Anyone constructing a custom `Envelope` with `steps` must move to `stops`.** It was never in the documented option vocabulary and is not exported, and the package had no consumers at the time — so this is a clean migration rather than a deprecation.

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
