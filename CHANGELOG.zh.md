# 更新日志

## [Unreleased]

### 变更

- **复制按钮移到了场的底部，并且成了全站唯一的主操作。** 它原先在右侧栏，读起来像四十个控件中的又一个。但你调的是**这个场**，所以把调好的东西带走的按钮属于这个场：它现在位于 sticky stage 内部、跨两列、满宽、用 accent 色。这个页面上其他一切都是为了帮你"调到某个值"而存在的；只有这一个是为了让你带着值离开，它也应该看起来就是那个区别。用 `var(--accent)` 而非硬编码色值，深色模式和以后换主题都会跟着走 —— focus ring 做了偏移，因为按钮**就是** accent，accent 描边压在 accent 填充上是看不见的。

- **Playground 现在能把自己的配置交给你。** readout 旁的复制按钮会复制安装命令、已经带上你调过参数的 `<DotMatrix>` 元素，以及样式表 import —— 所以粘贴之后不需要再打开这个页面，你也不需要。它复制的是一段 prompt 而不只是组件，因为没有安装方式的组件只是半条指令。**只输出你真正改过的参数**：每次都附上 `fill={1} peak={1} floor={0.16}` 既没有说明你选了什么，又会在默认值变动时过期；什么都没动就得到 `<DotMatrix />`，而 prop 名用的是真名 —— 看着对却编译不过的片段，和卡片自己重画点，是同一种错。动效旁边那行说明是从引擎自己的 preset 表里读出来的，所以不会和卡片对不上。剪贴板被拒绝时回退为可选中的文本，而不是一个什么都不做也不吭声的按钮。

- **Playground 现在开在一组手工挑的 showcase 参数上**，而不是引擎默认值：最大尺寸的 5×5、无间距、`dot/cell` 198% 让点连成一整块面、`grow` 3% 让点是"移动"而不是"脉动"、`stagger` 固定在 70% 以免换个动效就把访客正看着的滑杆挪走、剪影和点都是方形且圆角为 0。引擎自己的默认值没有动 —— 那是库的选择，页面被允许不同意 —— 所以这些值放在组件旁边一个具名的 `SHOWCASE` 里，每一项都写明为什么选它。

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
- **三个已发布的包既没有 README 也没有仓库链接**，npm 页面因此既没有正文、也没有回到源码的入口 —— 这和"不值得信任的包"看起来完全一样，而且连 issue 都不知道该往哪提。现在每个包都有自己的 README（按各自的读者写的），并声明 `repository`（含 `directory`，让链接直接落到该包子目录）、`homepage`、`bugs` 和 `keywords`。这四项由 `check-registry.mjs` 强制检查 —— 通过删掉 README 和 `repository`、确认构建失败来验证过。

### 修复

- **`chasing` 没有渐变 —— 它是三级台阶，不是波。** `chase` 带着 `steps: 3`，所以整个动效只有三个亮度值（0.16、0.58、1.00），每个格子跨过台阶都是跳变。实测一个周期内 `chase` 只有 **3** 个亮度层，而 `comet` 有 **78** 层。环上 `spread: 0.34` 时，同一帧里有多格跨过同一个台阶 —— 这就是它读起来不 smoother 的原因。现在是一个"快升 + 六段衰减"的 stop 表：**173** 层，相邻采样最大跳变从 ~0.42 降到 **0.03**。波峰后面那道仍然亮着的拖尾是新增的，`chasing` 现在终于读起来像它一直该像的 comet。
- `steps` 机制随之移除：`Envelope` 上的 `steps?: number` 字段、读它的 `level()` 分支、`field.ts` 里的 `data-timing="steps-N"` 切换，以及样式表里的 `steps(3, end)` 规则。`chase` 是唯一的使用者，所以这四处都在描述一个已删除的行为 —— 正是仓库自己的规则点名的死代码。现在每个 envelope 只有一种形态：stop 表或高斯。

- **有些动效卡片点不动，其中一张还会让页面崩溃。** 三个独立原因，`element.click()` 全部看不出来，全都是用 CDP 派发真实鼠标坐标才找到的：
  - 实时预览把 `onPointerEnter` 绑在了卡片 `<label>` **内部**的 div 上。指针移到卡片上会启动动画，重渲染打断 label 的点击，于是有一半卡片要点两三次。预览现在设为 `pointer-events: none`，内部不再对指针做任何反应。实测：修复前视口内 7 张只有 **4 张**第一次点中，修复后 **7 张全部**一次点中。
  - `scroll-snap-type: x proximity` 会让浏览器在指针离开后把卡片滑到行边缘，滑动过程中落下的点击打在卡片**原来的**位置。已移除：由指针驱动的滚动容器没有理由自己动。
  - `PRESETS.off` 是 `null`（"无动效"没有 order 也没有 envelope），而错峰控件读的是 `PRESETS[preset].spread`。选中 `off` 会抛 TypeError，渲染中断，整个卡片组停止更新。点击其实一直是送达的，是页面死在上面。

- **图片卡片盖在了 sticky 的预览区上。** `position: sticky` 和 `position: relative` 都是定位元素，而两者 `z-index` 都是 `auto` 时，DOM 里靠后的那个胜出 —— 于是 `SHAPE`、它的说明和卡片压在了 `dot/cell` 上，预览区看起来像是丢了自己的控件。现在预览区有明确的层级，卡片组不再需要。
- 预览区下方加了渐隐，让卡片读作"从它背后穿过"，而不是被它的边缘拦腰切断。内容从钉住的元素下方滚过本就是 sticky 的用途，但一张被切一半的卡片只会读成渲染故障。

- **`softness`、`grow`、`floor` 一直在页面上，只是够不到。** 它们落在侧栏的折叠线以下 —— 813px 视口里塞了 1001px 的内容，上面压着一组图片卡片，而这个列看不到底部 —— "这三个没法调"是位置问题，不是控件缺失。现在侧栏 sticky 且有独立滚动区，图片卡片移到它所描述的预览旁边，而这三个被提到几何细节之前、独立成组：点阵"感觉如何"总比"有多大"先被问到。readout 移到了 playground 下方 —— 它是输出不是输入，而且是侧栏里最便宜的 112px。

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

BotUI 的所有值得注意的变更都记录在此。格式遵循
[Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，registry 与各 package 一起版本化。

## [0.1.2] — 2026-09-30

### 修复

- **`chasing` 没有渐变 —— 它是三级台阶，不是波。** `chase` 带着 `steps: 3`，所以整个动效只有三个亮度值（0.16、0.58、1.00），每个格子跨过台阶都是跳变。实测一个周期内 `chase` 只有 **3** 个亮度层，而 `comet` 有 **78** 层。环上 `spread: 0.34` 时，同一帧里有多格跨过同一个台阶 —— 这就是它读起来不 smooth 的原因。现在是一个"快升 + 六段衰减"的 stop 表：**173** 层，相邻采样最大跳变从 ~0.42 降到 **0.03**。波峰后面那道仍然亮着的拖尾是新增的。

### 移除

- **`Envelope.steps`。** `chase` 不再量化之后，没有任何东西再读它：`Envelope` 上的字段、`level()` 的分支、`data-timing="steps-N"` 切换、以及 `steps(3, end)` CSS 规则，四处都在描述一个已不存在的行为。**任何自定义 `Envelope` 并使用了 `steps` 的代码都需要改用 `stops`。** 它从未进入文档化的选项词汇，也未被导出，且发布时该包尚无使用者 —— 所以这是一次干净的迁移，而不是标记弃用。

## [0.1.1] — 2026-09-30

### 新增

- 三个包都补上了 README 和完整的 npm 元数据：`repository`（含 `directory`，让链接落到该包的
  子目录）、`homepage`、`bugs`、`keywords`。0.1.0 的页面既没有正文，也没有回到源码的入口。

### 变更

- **Playground 默认使用 CSS 渲染器**，开关就放在它所渲染的点阵旁边。它是默认值，因为它每帧零 JS 开销，而 SVG 是留给 CSS 无法表达的动效的逃生舱 —— 所以你打开页面看到的就是大多数人真正会发布的那一个。拒绝说明挂在开关上：某个动效没有 CSS 形式的原因，就在你本来会去打开它的那个位置。
- **图片卡片改为横向滚动，不再换行。** 换行的 grid 会随选项增加而变高，而它所在的那一列本来就比视口高，于是每多一个形状就把滑杆再往下推。一行不占高度。`SHAPE` 打头，然后 `MOTION`，然后 `DOT SHAPE`。
- Playground 打开时的 dot/cell 比引擎默认更密。55% 的点阵读起来是散落的像素，而这个页面的主题正是"一个点是什么"；引擎自己的默认值没有动，因为那是库的选择。
- 侧栏不再 sticky。两列都 sticky 确实让滑杆可达，但也把整个右侧变成了一个你要独立滚动的面板 —— 这比让它随页面走更糟。

- **Playground 的形状与动效控件改成了卡片，不再是滑杆。** `sides` 和 `silhouette` 曾挤在同一个列表、同一个"形状"标题下，读者无法分辨哪个改变整体点阵、哪个改变每一个点；现在剪影是一组卡片（改变整个点阵的外轮廓），点是另一组卡片（改变每一个点本身），每组都在同一位置写明自己的作用范围。preset 曾是一个只列名字的 `<select>`，它无法表达 `spiral` 和 `ring` 的区别；现在是运行真实引擎的卡片，并且只有指针或焦点移上去时才播放，而不是十二个一起动。
- 每张卡片画的都是引擎自己的输出 —— 静帧用 `field()`、剪影用 `cellsFor()`、动效用实时点阵。卡片若自己画一个"近似"的点，那就是给它推销的东西写了第二份实现，glyph 代码一改就会漂移。相位刻意不用 0：遍历的动感在于格子之间的**差异**，而在 t=0 所有格子都处于静止，静帧只会显示一团均匀的模糊。
- 行列改成预览区上的加减步进器，`dot/cell` 也一并移了过去：它们是你盯着点阵时最常调的三个。整体 `size` 挪到最后，因为它决定占多少空间，而不是看起来是什么样。

- `check-registry.mjs` 现在会在已发布的包缺少 README、`repository` 未指向本仓库、缺少 homepage
  或 bugs URL 时让构建失败。

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
