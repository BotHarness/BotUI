# BotUI

Open-source UI components for agent products — the surfaces an agent app actually lives on: loading states, streaming indicators, status.

Install a component with `npx`, and the source lands in your repo. **No runtime dependency. Nothing to keep current. The code is yours** — read it, change it, delete the name.

```bash
npx @botharness/botui add dot-matrix
```

```bash
npx @botharness/botui list          # what the registry offers
npx @botharness/botui info <name>   # what one component ships
npx @botharness/botui add <name> --dry-run
```

## Why copy-and-own

A loading indicator is not a place to take a runtime dependency. It is thirty lines of animation you will want to tune to your own brand, and the moment it is a dependency, tuning it means a version bump or a patch-package.

So BotUI ships **the real source files**, not a bundle. What lands in `components/botui/` is the same text as this repository, and a test in CI asserts it byte for byte. When BotUI ships something better, you take the diff when you want to.

It is also compatible with shadcn's registry format, so this works too:

```bash
npx shadcn@latest add https://ui.botharness.ai/r/dot-matrix.json
```

## Components

### `dot-matrix`

A loading field built as five replaceable layers. The interesting questions — which shape, which motion, which dot — are independent, and each one is a table you can extend without touching the layers above.

| Layer         | Question it answers                                                                 |
| ------------- | ----------------------------------------------------------------------------------- |
| **Lattice**   | which cells exist (`square`, `circle`, `diamond`, `hex`, `ring`, `cross`)           |
| **Traversal** | what order the light moves in (`spiral`, `columnSnake`, `radial`, `ring`, …)        |
| **Envelope**  | how bright a cell is over the cycle (`comet`, `wave`, `plateau`, `chase`, …)        |
| **Glyph**     | how one dot is drawn — a polygon plus two corner radii, not a table of named shapes |
| **Renderer**  | SVG (painted per frame) or CSS (`@keyframes`, zero JS per frame)                    |

```ts
import { createDotMatrix } from "./components/botui";

const field = createDotMatrix(document.querySelector("#loading")!, {
  size: 32,
  cols: 5,
  rows: 5,
  silhouette: "circle",
  dot: "circle",
  preset: "spiral",
});
field.start();
```

```tsx
// React: state is the vocabulary an agent UI already speaks
<DotMatrix state="thinking" size={24} />
<DotMatrix state="streaming" size={24} renderer="css" />
```

Both renderers are driven by the same `field(options, t)` — a pure function of the options and a phase. That is what makes the CSS path trustworthy: it cannot drift from the SVG one, because it is not a second implementation.

The full option list, and the reasoning behind the size algebra, are in [`packages/core/src/types.ts`](packages/core/src/types.ts).

## Packages

| Package                   | What it is                    |
| ------------------------- | ----------------------------- |
| `@botharness/botui-core`  | the framework-agnostic engine |
| `@botharness/botui-react` | `<DotMatrix>`                 |
| `@botharness/botui`       | the installer                 |

Using them as npm packages is supported but not the recommended path — the point is that you do not have to.

## Development

```bash
pnpm install
pnpm build            # packages → CSS → registry → site
pnpm verify           # format, lint, typecheck, test, registry check
```

`pnpm build` runs four steps in order, and each one is a build artefact rather than a checked-in file:

1. `tsdown` per package
2. `scripts/emit-css.mjs` — the stylesheet, generated from the same envelope functions the runtime uses
3. `scripts/build-registry.mjs` — `registry.json` and `r/*.json`, projected from `packages/*`
4. `scripts/build-site.mjs` — the demo page, running the built engine

The generated registry is never committed. A hand-maintained JSON carrying a copy of the source is a second source of truth that goes stale the first time a line changes upstream; `scripts/check-registry.mjs` exists to keep that from ever being possible, and it fails the build on an undeclared import, an escaping target, a missing dependency or a stale served item.

## Deploying the site

The registry is served from a Cloudflare Worker on `ui.botharness.ai`:

```bash
pnpm build
pnpm --filter botui-site deploy   # or: wrangler deploy -c apps/site/wrangler.jsonc
```

## License

MIT. See [LICENSE](LICENSE).

The implementation is original. Where another loading-indicator library informed a decision, the reasoning is cited in the source comments and the choice was re-derived rather than copied.
