# Agent 闪卡（Agent Flashcards）

像背单词一样学习 Agent 知识的**移动优先 PWA**：8 个 deck、204 张卡片（问答 / 选择题 / 填空），
用 [FSRS-6](https://github.com/open-spaced-repetition/fsrs4anki/wiki/The-Algorithm) 安排每日复习，
可安装到主屏、可离线使用，**学习进度只保存在本机**。

> 本项目位于仓库的 `app/`，题库内容由仓库根目录的 `content/decks/*.json` 提供（见「内容同步」）。

---

## 1. 技术栈与选型理由

| 层 | 选择 | 理由 |
| --- | --- | --- |
| 构建 | **Vite 8** + React 19 + TypeScript 6 | 冷启动快、产物小；`tsc -b` 做类型门禁 |
| 调度 | **ts-fsrs 5.4.2**（FSRS-6） | MIT、零运行时依赖、纯函数式；不自己发明间隔算法（见 §8） |
| 存储 | **Dexie 4**（IndexedDB） | 本地优先、schema 版本化、事务；刷新/离线都不丢进度 |
| PWA | **vite-plugin-pwa 2**（Workbox `generateSW`） | 一行配置预缓存全部静态资源与 `index.html` |
| 路由 | **自写 hash 路由**（约 60 行） | 静态托管零配置、无需服务端 rewrite、离线刷新天然可用 |
| 样式 | **原生 CSS**（CSS 变量 + 媒体查询） | 不引入 UI 框架/Tailwind：依赖更少、体积更小、深色模式只需一个 `data-theme` |
| 测试 | **Vitest 5** + Testing Library + jsdom | 纯逻辑单测 + 卡片渲染 DOM 测试 |
| 图标 | **纯 Node 手写 PNG 编码器** | 不引入 sharp/canvas，`npm run gen:icons` 可复现 |

没有 pnpm、没有 UI 组件库、没有状态管理库（`useAsyncData` + 一个 20 行的变更通知器足够）。

---

## 2. 目录结构

```
app/
├── index.html                  # 首屏主题脚本（防闪烁）、iOS meta、manifest 注入点
├── vite.config.ts              # base / PWA manifest / Workbox 预缓存
├── vitest.config.ts            # jsdom 环境 + setup
├── scripts/
│   ├── sync-content.mjs        # ../content/decks/*.json → src/content/ + 生成 index.ts
│   └── gen-icons.mjs           # 纯 Node PNG 编码器，生成 192/512/maskable/apple 图标
├── public/                     # icons/、apple-touch-icon.png、favicon.svg
└── src/
    ├── main.tsx                # 挂载 + registerSW + 主题
    ├── App.tsx                 # 路由分发、TabBar、主题同步、错误边界
    ├── index.css               # 设计令牌、深色模式、375px 布局、翻面动画、安全区
    ├── lib/
    │   ├── scheduler.ts        # ★ ts-fsrs 薄适配层（唯一调度来源）
    │   ├── queue.ts            # 队列构建（到期优先 / 每日上限 / learn-ahead）
    │   ├── db.ts               # Dexie 三张表 + 导入导出事务
    │   ├── importExport.ts     # 备份校验、按 cardId 合并、日志去重
    │   ├── settings.ts         # 默认值、上下限、主题应用
    │   ├── stats.ts            # 首页/统计页的纯聚合函数
    │   ├── dates.ts            # 本地日界（YYYY-MM-DD）与人性化时间
    │   ├── content.ts          # 题库归一化（容错各种字段别名）
    │   ├── cloze.ts            # {{c1::}} 挖空解析
    │   ├── router.ts           # hash 路由
    │   └── store.ts            # useAsyncData + DB 变更通知
    ├── components/             # CardView / RatingBar / RichText / ProgressRing / TabBar / Toast …
    ├── pages/                  # HomePage / StudyPage / StatsPage / SettingsPage
    ├── content/
    │   ├── index.ts            # 自动生成（勿手改）
    │   ├── decks/              # 从 content/decks 同步来的真实题库（构建产物，可提交）
    │   └── fallback/           # 3 个兜底 deck（每 deck 3 张，qa/mcq/cloze 各一）
    └── test/setup.ts
```

---

## 3. 命令

```powershell
cd app
npm install

npm run dev            # 开发服务器（会先自动同步内容）
npm run build          # 同步内容 → tsc -b 类型检查 → vite build（输出 dist/）
npm run preview        # 预览产物：http://127.0.0.1:4173/
npm run test           # Vitest 全量（默认 run 一次）
npm run test:watch     # 监视模式
npm run smoke          # 对 preview 产物跑 375x812 浏览器冒烟（需先 build + preview）
npm run sync:content   # 只做内容同步
npm run gen:icons      # 重新生成 PWA 图标
npm run lint           # oxlint
```

> `preview` 显式绑定 `127.0.0.1:4173`（Windows 上 Vite 默认只监听 `::1`，用 `127.0.0.1` 更省事）。

---

## 4. 内容同步（题库从哪来）

1. 题库源在仓库根的 `content/decks/*.json`（**本应用不修改该目录**）。
2. `npm run sync:content`（也会在 `dev` / `build` 前自动执行）会：
   - 读取 `content/decks/*.json`，逐个 JSON 解析校验；
   - 原样复制到 `src/content/decks/`；
   - 生成 `src/content/index.ts`（静态 import，不用 `import.meta.glob`，产物更可控）。
3. **容错**：`content/` 缺失、文件损坏、字段不规范都只会打印警告而**不影响构建**；
   此时自动回退到 `src/content/fallback/` 的 3 个内置 deck，保证 `npm run dev` 永远可用。
4. 合并规则（`src/lib/content.ts` 的 `buildDecks`）：
   - 真实内容优先；按 `id` 或标题关键词（基础 / 面试 / 后训练）匹配 3 个规范槽位；
   - 真实内容没覆盖的槽位，用兜底 deck 补上，并标记「示例」徽标；
   - 额外的真实 deck 追加在 3 个规范 deck 之后；
   - 卡片进度键为 `deckId::cardId`，全局唯一。

### 4.1 支持的卡片字段

```jsonc
{
  "id": "agent-basics",              // 或 slug / deckId / 省略（用文件名）
  "title": "Agent 基础知识",
  "description": "……",
  "cards": [
    { "id": "basics-001", "type": "qa",    "question": "…", "answer": "…", "explanation": "…", "tags": ["…"], "source": "…" },
    { "id": "basics-007", "type": "mcq",   "question": "…", "choices": ["A","B","C","D"], "answerIndex": 1, "explanation": "…" },
    { "id": "basics-003", "type": "cloze", "question": "…{{c1::Thought}}…", "answer": "完整句/要点" }
  ]
}
```

宽松别名：`choices`/`options`、`answer`/`a`/`back`、`question`/`q`/`front`/`prompt`、
`explanation`/`note`/`rationale`、`answerIndex`/`correct`/`answer`（数字或 "B"）。
`type` 缺失时会按形状推断（有 `choices` → mcq；含 `{{c1::}}` → cloze；否则 qa）。
答案支持轻量 Markdown：段落、`-` 列表、`**加粗**`、`` `代码` ``、``` ``` 代码块 ```。

### 4.2 新增一个 deck

1. 在 `content/decks/` 放一个新的 `*.json`（哪怕不在 3 个规范槽位里也会被显示）；
2. `npm run sync:content`（或直接 `npm run dev`）；
3. 注意：改动**已有卡片的 `id`** 会让对应卡片的复习进度变成孤儿（新 id 视为新卡）。

---

## 5. PWA：安装与部署

- 构建产物 `dist/` 是纯静态文件，**任意静态托管**都能跑（Nginx、Caddy、S3、GitHub Pages、Cloudflare Pages…）。
- 部署在子路径（如 GitHub Pages 项目页）时用：

  ```powershell
  $env:BASE_PATH='/my-repo/'; npm run build     # PowerShell
  BASE_PATH=/my-repo/ npm run build             # bash
  ```

  `BASE_PATH` 同时作用于 `base`、manifest 的 `start_url`/`scope` 与 Workbox 的 `navigateFallback`。
- 安装：Android/桌面 Chrome 打开后地址栏出现「安装」；iOS Safari 用「共享 → 添加到主屏幕」。
- 离线：首次访问后 Service Worker 预缓存 500 KB 左右（16 个条目），断网刷新仍可用。
  **必须在 `https://` 或 `http://localhost` 下**：非安全上下文不注册 Service Worker。
- 更新策略：`registerType: 'autoUpdate'`，新版本部署后下次进入会自动接管缓存。

---

## 6. 数据与隐私

- **本地优先**：卡片状态、复习日志、设置全部存在浏览器 IndexedDB（库名 `agent-flashcards`），
  没有任何网络请求，没有账号，没有服务端。
- 三张表（`db.ts` 中 `version(1)` 声明，后续变更需要 bump 版本 + `upgrade()`）：

  | 表 | 主键 / 索引 | 内容 |
  | --- | --- | --- |
  | `cardStates` | `cardId`, `deckId`, `due`, `state`, `last_review` | 每张卡的 FSRS 状态（`due`/`last_review` 存 epoch ms） |
  | `reviewLogs` | `++id`, `cardId`, `deckId`, `day`, `review` | 追加型复习事件，用于统计、连续天数、每日配额 |
  | `settings` | `key` | 单行 `key: 'app'`：每日新卡/复习上限、learn-ahead 窗口、主题 |

- **备份**：设置页「导出」生成 `agent-flashcards-YYYY-MM-DD.json`（含 `app`、`version`、
  `cardStates`、`settings`、`reviewLogs`）。「导入」会校验结构与版本，按 `cardId` 合并，
  **较新的记录优先**（不会用旧备份覆盖更新的进度），日志按 `(cardId, review, rating)` 去重。
- **会丢进度的场景**：清除浏览器数据、无痕模式、iOS 长期未使用被系统回收存储、换设备。请定期导出。
- 首次进入设置页会尝试 `navigator.storage.persist()` 申请持久化存储，降低被清理的概率。

---

## 7. 交互与可访问性

- 键盘：`空格` 翻面（翻面后再次空格 = 提交建议评分）、`1`–`4` = 忘了/困难/记得/太简单、`Enter` 在卡片上翻面。
- 焦点按钮上的空格交给浏览器原生行为，避免「空格既触发按钮又触发快捷键」。
- 卡片双面都在 DOM 中（3D 翻面需要），但隐藏面 `aria-hidden="true"`、`pointer-events: none`、
  可聚焦元素 `tabindex="-1"`，屏幕阅读器与键盘都只会看到当前一面。
- 触摸目标 ≥44px（主按钮 48、评分按钮 56+、tab 62、步进器 44）；`prefers-reduced-motion` 下
  取消所有过渡并退化为面切换。
- 375px 宽度下无横向滚动（Playwright 实测 `scrollWidth === innerWidth`）；安全区用
  `env(safe-area-inset-*)` 处理 iPhone 刘海与底部指示条。

---

## 8. FSRS 行为（本机实测，非推测）

`ts-fsrs@5.4.2` 实际行为（`fsrs({ enable_fuzz: false })`，短周期学习步开启）：

| 场景 | Again | Hard | Good | Easy |
| --- | --- | --- | --- | --- |
| 新卡 | 1 分钟后（Learning） | 6 分钟后（Learning） | 10 分钟后（Learning） | 8 天后（Review） |
| 已毕业的 Review 卡（按其到期时间复习） | 10 分钟后（Relearning） | 27 天 | 39 天 | 66 天 |

由此带来两个实现决定：

1. **learn-ahead 窗口**（默认 20 分钟，设置页可调）：常规「到期复习 + 新卡」队列之后，
   把处于 Learning/Relearning 且 `due <= now + 窗口` 的卡片追加到本次会话。
   否则刚评「记得」的卡 10 分钟后才到期，用户会以为评分没生效。
   重新入队的卡会在进度副标题里显示「含 N 张待巩固」，且不会让进度条倒退。
2. **`enable_fuzz: false`**：关闭间隔抖动，同样的输入得到同样的计划，便于测试与复现。
   `learning_steps`、`elapsed_days`、`scheduled_days`、`reps`、`lapses`、`last_review` 全部持久化，
   刷新后可以从中断处精确续算。

日期一律用**本地日界** `YYYY-MM-DD`（`getFullYear/getMonth/getDate` 拼接，绝不用 `toISOString()`），
避免 UTC 偏移导致「今天」错位；跨月/跨年/闰日与「午夜前后算两天」都有单测覆盖。

---

## 9. 测试与验收（可复现）

```powershell
cd app
npm run test            # 7 个文件 / 83 个用例
npm run build           # tsc -b + vite build，产物 dist/
npm run preview         # 前台或后台起在 127.0.0.1:4173
```

覆盖范围：

| 文件 | 关注点 |
| --- | --- |
| `src/lib/scheduler.test.ts` | 新卡 Good 后 due 在将来、Again 后续在几分钟内、四档间隔严格单调（新卡 & Review 卡）、`learning_steps` 往返、日志字段 |
| `src/lib/queue.test.ts` | 到期优先且按 due 升序、新卡/复习上限与「今日已用」扣减、deck 过滤 vs 混合、learn-ahead 追加、零上限空队列、`shouldRequeue` |
| `src/lib/importExport.test.ts` | 坏 JSON/坏版本/未来版本/异应用备份全部拒绝；ISO 时间归一化；重复 cardId 去重；合并时较新优先；日志去重；设置 clamp |
| `src/lib/dates.test.ts` | 本地日界（UTC 偏移下不漂移）、跨月跨年闰日差值、7 天窗口、连续天数（含「今天还没学」）、间隔文案 |
| `src/lib/cloze.test.ts` | 挖空解析、提示、首尾挖空、计数与全揭示 |
| `src/lib/content.test.ts` | 真实 schema 归一化（`choices`/cloze-in-question）、类型推断、重复 id、丢弃空卡、兜底与真实内容合并、`uid` 命名空间 |
| `src/components/CardView.test.tsx` | qa 正面/背面、点击翻面、cloze 挖空逐个揭晓且不误触翻面、mcq 选项与对错解析、隐藏面退出 tab 序与无障碍树、出处行 |

浏览器端冒烟（`scripts/smoke-preview.mjs`，Playwright 驱动**系统 Chrome**，375×812 @2x）实测通过 **51/51** 项：

```powershell
npm run build
npm run preview          # 另开一个终端（或后台任务）
npm run smoke            # 截图与导出样例落在 .smoke/（已 gitignore）
```

覆盖：8 个 deck 可见、`scrollWidth === innerWidth`、触摸目标 ≥44px、隐藏面退出无障碍树与指针、
翻面 → 评分 → 进度前进、空格/数字键、cloze 逐个揭晓、mcq 对错判定与解析、
IndexedDB 落库、**刷新后进度仍在**、统计页 7 根柱、导出下载与**回导成功**、
重置二次确认、会话小结、manifest/theme-color/Service Worker 激活、**断网刷新仍可用**、无控制台错误。

> 冒烟脚本依赖 `playwright-core`（已在 devDependencies，约 2 MB，不下载浏览器）；
> 若系统里只有 Edge：`$env:SMOKE_BROWSER='msedge'; npm run smoke`。

---

## 10. 已知限制

1. **长答案在卡片内滚动**：3D 翻面要求两面绝对定位，卡片高度固定为 `clamp(320px, 54vh, 500px)`；
   超长（面试题 400 字 + 解析 + 出处）时背面需在卡片内滚动。
2. **每日上限是全局的**，不是每 deck 独立；`newPerDay` 步进器按 5 递增（可手输任意 0–500）。
3. **卡片 id 是进度主键**：题库改了某张卡的 `id` 或 deck 的 `id`，旧进度会变成孤儿（不报错，只是从头学）。
4. **无多端同步**：本地优先的代价；换设备请用导出/导入迁移，合并时以「复习时间较新」为准。
5. **导入只支持 `version <= 1`**：未来版本会明确拒绝并提示升级应用。
6. **统计页会把全部复习日志读入内存**：日均 100 张、持续数年也只在几万条量级，暂时可接受；
   将来可改为按 `day` 索引聚合。
7. **iOS 限制**：Safari 的 IndexedDB 在长期不用时可能被系统回收；PWA 的「安装」入口只能在 Safari 分享菜单。
8. **Service Worker 需要安全上下文**：`file://` 直接打开 `dist/index.html` 可用但没有离线缓存。
9. 题库内容的正确性由 `content/` 负责，应用侧只做展示；卡片内容为学习辅助材料，见设置页免责声明。

---

## 11. 许可与出处

- 调度算法：[open-spaced-repetition/ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs)（MIT）。
- 题库内容出处标注在每张卡的 `source` 字段，并显示在卡片背面。
