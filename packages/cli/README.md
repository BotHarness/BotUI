# @botharness/botui

Install BotUI components into your project — copy-and-own, like [shadcn](https://ui.shadcn.com).

```bash
npx @botharness/botui add dot-matrix
```

The source lands in your repo. **No runtime dependency. Nothing to keep current. The code is
yours** — read it, change it, delete the name.

## Why

A loading indicator is not a place to take a runtime dependency. It is thirty lines of animation
you will want to tune to your own brand, and the moment it is a dependency, tuning it means a
version bump or a patch-package.

So this installer copies **the real source files**, not a bundle. What lands in
`components/botui/` is the same text as the [BotUI repository](https://github.com/BotHarness/BotUI),
and a test in CI asserts it byte for byte. When BotUI ships something better, you take the diff
when you want to.

## Commands

```bash
npx @botharness/botui list            # what the registry offers
npx @botharness/botui info <name>     # what one component ships
npx @botharness/botui add <name>      # copy it into your project
npx @botharness/botui add <name> --dry-run   # show the plan, write nothing
```

## Also works with shadcn

The registry is served in shadcn's format, so this installs the same component:

```bash
npx shadcn@latest add https://ui.botharness.ai/r/dot-matrix.json
```

Files are fetched from the registry at `ui.botharness.ai`, not from npm — so a published version
whose registry item is not deployed yet installs nothing. That ordering is deliberate; see
[Releasing](https://github.com/BotHarness/BotUI#releasing).

## Documentation

**[ui.botharness.ai](https://ui.botharness.ai)** — a live playground for every component, in
[English](https://ui.botharness.ai/) and [中文](https://ui.botharness.ai/zh/).

## License

MIT © [BotHarness](https://github.com/BotHarness/BotUI)
