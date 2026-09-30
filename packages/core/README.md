# @botharness/botui-core

The framework-agnostic engine behind BotUI components — no DOM library, no framework, one dependency: none.

This is the layer that decides **which cells exist**, **what order the light moves in**, **how bright each cell is over the cycle**, and **how one dot is drawn**. Those are independent questions, so they are independent tables you can extend without touching each other.

## Install

You probably don't need this package. The recommended path is to copy the source into your repo:

```bash
npx @botharness/botui add dot-matrix
```

Install it from npm when you want the engine as a dependency, or when you are building tooling on top of it:

```bash
npm install @botharness/botui-core
```

## Use

```ts
import { createDotMatrix } from "@botharness/botui-core";
import "@botharness/botui-core/style.css"; // required for renderer: "css"

const field = createDotMatrix(document.querySelector("#loading")!, {
  size: 32,
  cols: 5,
  rows: 5,
  silhouette: "circle",
  dot: "circle",
  preset: "spiral",
});

field.start();
// …later
field.destroy();
```

### The two renderers

| `renderer`        | Cost                                          | Use when                                        |
| ----------------- | --------------------------------------------- | ----------------------------------------------- |
| `"svg"` (default) | one attribute write per visible dot per frame | you animate size, shape, or dot count           |
| `"css"`           | **zero JS per frame** — one `@keyframes` rule | the geometry is fixed and only brightness moves |

Both are driven by the same `field(options, t)`, a pure function of the options and a phase. That is the whole reason the CSS path is trustworthy: it is not a second implementation, so it cannot drift from the SVG one.

`cssRenderable(options)` tells you up front whether a motion can be expressed as keyframes. Some cannot — `columns` staggers each column's entry, which a per-dot `animation-delay` does not model — and the function returns `false` rather than silently rendering something else.

### The five layers

| Layer         | Question it answers                                                       |
| ------------- | ------------------------------------------------------------------------- |
| **Lattice**   | which cells exist (`square`, `circle`, `diamond`, `hex`, `ring`, `cross`) |
| **Traversal** | what order the light moves in (`spiral`, `columnSnake`, `radial`, `ring`) |
| **Envelope**  | how bright a cell is over the cycle (`comet`, `wave`, `plateau`, `chase`) |
| **Glyph**     | how one dot is drawn — a polygon plus two corner radii                    |
| **Renderer**  | SVG or CSS                                                                |

The full option list, and the reasoning behind the size algebra, are in
[`src/types.ts`](https://github.com/BotHarness/BotUI/blob/main/packages/core/src/types.ts).

## Documentation

**[ui.botharness.ai](https://ui.botharness.ai)** — a live playground for every control, in
[English](https://ui.botharness.ai/) and [中文](https://ui.botharness.ai/zh/).

## License

MIT © [BotHarness](https://github.com/BotHarness/BotUI)
