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

### 新增

- 站点现在直接以 playground 开头，紧接在安装命令下面。它是页面的主题，让你先滚过组件索引才能
  到它是一次多余的绕路；island 用 `client:load` 而不是 `client:visible`，落地即可交互。
- Playground 控件分组：**shape**（silhouette、点的 `sides`、点预设、圆角、拉伸）、**size**
  （px、cols、rows、点占格、列/行 gap）、**motion**（preset、**速度**、错峰、波宽、呼吸、底噪）。
  速度之前完全缺失，导致这个 demo 是个调不慢的 GIF。
- 两个形状都是**滑杆**而不是下拉。点是一个多边形加两个半径，所以 `sides` 才是诚实的控件，拖一下
  才会发现七边形就是七边形。命名字形保留为第二个控件，覆盖 `sides` 够不到的部分 —— 星形是点
  *之间*的凹口。
- 引擎导出 `cssRenderable()` / `cssRenderGap()`，调用方直接问组件 CSS 渲染器能否表达某个动效，
  而不是自己重写这条规则。playground 之前检查的是 preset **是否存在**，所以 `columns`（per-dot
  delay 无法表达的动效）的复选框仍然是可勾选状态。
- **站点现在支持双语。** 英文在 `/`，中文在 `/zh/`，文案来自 `apps/site/messages/` 下的 Paraglide
  消息目录；两个语言之间是真实链接，页面带各自的 `hreflang`，`<html lang>` 与文案一致。切换器
  指向另一个语言的**文件**，而不是客户端 toggle —— 这样关掉 JavaScript 也能到达 `/zh/`，搜索引擎
  也能抓到。
- `pnpm i18n` 编译消息目录。`apps/site/src/paraglide` 是生成产物且被 gitignore，因此 `typecheck`
  和 `verify` 现在会先跑这一步：全新 clone 时它们原本会因为引用尚不存在的文件而失败。
- `apps/site/test/playground.test.tsx` 驱动真实控件：10 个测试派发 input 事件并断言场确实变了。
  一个渲染出来但不干活的滑杆，在截图和 DOM dump 里和一个正常工作的滑杆无法区分。
- **发布到 npm 需要一个 token，而这个账号的 2FA 是 passkey**，CLI 无法完成 WebAuthn 挑战（那需要浏览器）。
  `scripts/npm-token.sh` 收集 granular access token、向 registry 校验、并存进 `npm_release.token`
  （已 gitignore，权限 600）；token 过期或被撤销后它会自行重新询问。`release.mjs` 读取该文件，
  通过子进程的环境变量把 token 交给 npm，而不是作为 argv 参数 —— argv 能被 `ps` 读到，命令行也会进
  CI 日志。项目级 `.npmrc` 同样可行，但那会让 token 对仓库里每一条 npm 命令生效，连 `npm install` 一起。

### 修复

- **三个 playground 滑杆以同一种方式坏掉，而当时的测试全都看不出来。** `radius`、`aspect`、
  `speed` 把 0…1 的原始值传给了以百分之一为单位的轨道。radius `0.7` 落在 `0…90` 的轨道上，
  滑块停在全程的 0.8%，所以"感觉拉不动"；`speed` 1 落在 `5…300` 上、`aspect` 1 落在
  `20…100` 上，都被浏览器静默钳到最小值，所以"感觉没变化"。×100 现在只存在于一个
  `PercentSlider` 组件里，任何调用点都写不错。
- radius 滑杆的最大值现在是该多边形**自身的内切半径**，所以拖到底一定得到一个圆 —— 三角
  50%、方形 71%、五边 81% 都是如此。原来的固定 90% 对某些形状够不到，对另一些毫无意义。
- `apps/site/test/playground.test.tsx` 里新增两条审计：把每个滑杆的滑块位置和它旁边的数字
  对照，把请求值和声明范围对照。两条都通过"重新植入缺陷"验证过确实会失败。

- **错峰滑杆是单向门。** 它的默认值来自 _preset_ 的 spread，所以一旦拖动，`stagger` 就永远
  是个数字：标签不再显示"预设"、切换 preset 也不再带动滑杆，而且界面上没有任何回去的入口。
  现在标签显示 preset 自身的数值（`预设 95%`，因此标签永远不会和滑块矛盾），并且在值被覆盖
  时才出现一个「回到预设」控件。
- 滑杆审计现在在标签**任意位置**找百分比，而不再只匹配开头。只匹配开头意味着"默认值来自
  preset 的那个滑杆"恰好是审计唯一跳过的滑杆 —— 这就是为什么只写着"预设"、滑块却停在 95 的
  标签能一直存在。
- **中文页面一加载完就退回英文。** 服务端渲染出的 HTML 是对的，因为 SSG middleware 直接设置了
  locale；但每个 island 自己从 URL 解析文案，而默认语言的 URL pattern 是通配的 `/:path(.*)?`，
  它同样能匹配 `/zh/` —— 把 "zh" 当成路径段读走了。Paraglide 取第一个匹配的 pattern，于是英文
  赢下所有 URL。现在默认语言的 pattern 精确为 `/`，并且
  `apps/site/test/locale-resolution.test.tsx` 会在两个 URL 下分别渲染 playground，断言只在其中一个
  目录里存在的文案。区块标题本来抓不到这个问题：它们在两个目录里都是双语的，所以页面看起来只是
  「翻译了一半」。
- Paraglide 的编译选项被写了两份 —— `astro.config.mjs` 和 `project.inlang/paraglide.config.js`
  —— 而且两份已经漂移：独立那份仍把英文放在 `/en/`，而 Astro 一直写在 `/`。从 CLI 跑一次
  `paraglide compile` 就会生成一个与线上不一致的 runtime。现在两份都读
  `project.inlang/paraglide.options.js`。

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
