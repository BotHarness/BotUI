# 更新日志

BotUI 的所有值得注意的变更都记录在此。格式遵循
[Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，registry 与各 package 一起版本化。

## [Unreleased]

### 变更

- **站点改为 Astro + React islands，部署到 Cloudflare Pages。** `apps/site` 原先是一个手写 HTML + module script，
  由 Worker 静态资源托管；现在是 `output: 'static'` 的 Astro 7 + React 19.3 islands，由 Vite 构建，部署到
  `botui-site` Pages 项目。demo 直接挂载 `@botharness/botui-core`，而不是走已发布的 React wrapper —— 否则文档站
  会继承 wrapper 的每一个修复，并据此宣称组件是好的。
- 工具链升级到 TypeScript 7、Vite 8、React 19.3、Astro 7。TS 7 移除了 `baseUrl`，因此 `tsconfig.base.json` 里的
  `paths` 改为显式 `./` 前缀。

## [0.1.0] — 2026-09-30

### 新增

- **`dot-matrix`** —— 由五层可替换结构组成的 loading 点阵：点阵/轮廓、遍历顺序、亮度包络、
  点字形多边形、渲染器。两个渲染器（SVG 逐帧、CSS `@keyframes` 零 JS 逐帧）由同一个
  `field(options, t)` 驱动，因此不可能产生分歧。
- **`dot-matrix-react`** —— `<DotMatrix>` 包装组件，`state="thinking"` 可直接把 agent 状态
  映射为动效。
- 兼容 shadcn 格式的 registry，托管在 `https://ui.botharness.ai`：
  `npx shadcn@latest add https://ui.botharness.ai/r/dot-matrix.json` 与
  `npx @botharness/botui add dot-matrix` 装到的是同一份组件。
- `@botharness/botui` —— 安装器，提供 `add` / `list` / `info`、`--dry-run`、`--force`
  以及冲突提示。
- `ui.botharness.ai` 上的文档站，跑的是构建产物而不是源码副本。

[Unreleased]: https://github.com/BotHarness/BotUI/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/BotHarness/BotUI/releases/tag/v0.1.0
