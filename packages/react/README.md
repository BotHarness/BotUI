# @botharness/botui-react

React bindings for [BotUI](https://github.com/BotHarness/BotUI) components — `<DotMatrix>`.

The engine ([`@botharness/botui-core`](https://www.npmjs.com/package/@botharness/botui-core))
does the work; this package is a ref and an effect. That is deliberate: a component that owns
no geometry cannot drift from the engine that does.

## Install

You probably don't need this package. The recommended path is to copy the source into your repo:

```bash
npx @botharness/botui add dot-matrix
```

Install it from npm when you want a component you can import and upgrade:

```bash
npm install @botharness/botui-react @botharness/botui-core
```

`react` is a peer dependency (`>=18`); the stylesheet ships with the core package:

```ts
import "@botharness/botui-core/style.css"; // once, in your app entry
```

## Use

```tsx
import { DotMatrix } from "@botharness/botui-react";

// `state` is the vocabulary an agent UI already speaks
<DotMatrix state="thinking" size={24} />
<DotMatrix state="streaming" size={24} renderer="css" />
```

`state` is a **preset** — motion plus the agent state it is meant to express. If you want the
underlying geometry instead, pass the options directly and `preset` becomes optional:

```tsx
<DotMatrix size={24} cols={5} rows={5} silhouette="circle" dot="circle" />
```

`renderer="css"` costs zero JS per frame but only works for motions the engine can express as
keyframes. The component checks for you: asking for an unsupported motion falls back to SVG
rather than rendering something that does not match the preview.

## Documentation

**[ui.botharness.ai](https://ui.botharness.ai)** — a live playground for every prop, in
[English](https://ui.botharness.ai/) and [中文](https://ui.botharness.ai/zh/).

## License

MIT © [BotHarness](https://github.com/BotHarness/BotUI)
