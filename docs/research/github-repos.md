# GitHub 调研：背单词 / 闪卡 / SRS 开源项目（可复用性评估）

> 调研时间：2026-10-26（Asia/Shanghai）  
> 方法：GitHub REST API（`/search/repositories`、`/repos/{owner}/{repo}`）+ 仓库 README/LICENSE 原文 + npm 实测。  
> 说明：stars / pushed_at 为抓取瞬间值，会随时间变化；未抓到的字段标注「未核实」，不做推测。  
> 关联：[产品与内容设计](../01-product-design.md) · [架构设计](../02-architecture.md)

---

## 0. 结论摘要（TL;DR）

1. **算法层直接复用 `open-spaced-repetition/ts-fsrs`（MIT，835★，npm 5.4.2 / FSRS-6）**。它是 Anki 同源 FSRS 算法的 TypeScript 实现，提供四档评分、短期学习步骤、参数化与结果预演，正好覆盖「背单词式」复习调度，**不需要自研 SRS**。
2. **不 fork Anki / AnkiDroid**：Anki 为 Rust + Python(Qt) 且 **AGPL-3.0-or-later**；AnkiDroid 为 Kotlin 且 **GPL-3.0**。许可证传染 + 技术栈不匹配 + 通用工具形态过重，改造成本远高于自研薄壳（约 1.5–2k 行 UI + 数据层）。
3. **不 fork 现成 Web 闪卡应用，但有一个高价值参考实现**：`designfuchen/word-atlas`（1,485★，代码 MIT + 数据集 CC BY 4.0，React 19 + Vite + **ts-fsrs** + WebGL2，本地优先、无账号）几乎是本产品形态的现成版本，验证了「ts-fsrs + 移动端薄壳 + 本地进度」路线；不 fork 的原因：它绑定雅思插画/音频内容管线与 WebGL 图鉴，Agent 文本卡用不上，且数据集 CC BY 4.0 需署名。其他 MIT 项目多绑定 Next.js + 数据库 + 账号（如 StudyFlow），或长期停更（carden 2022-06），拆后端等于重写。
4. **UI 自研薄壳，但交互模式复用成熟实践**：Anki 的学习步骤（1m/10m）、learn-ahead（20 分钟窗口）、四档评分、到期优先队列；AnkiDroid 的移动端手势与安全区处理作为参考。
5. **内容互操作复用 `anki-apkg-export` / `genanki` 的思路**：V1 用自有 JSON 为 canonical，V2 再做 Anki TSV/APKG 导出（浏览器侧可用 `anki-apkg-export`，MIT）。
6. **微信小程序**：V1 不做；若必须覆盖微信，用 Taro 复用纯 TS 域逻辑（scheduler/queue/content），UI 与存储重写。**不建议**为了小程序放弃 PWA 的即时安装与三端覆盖。

**推荐复用路径：ts-fsrs（算法） + Dexie（本地存储） + vite-plugin-pwa（离线/安装） + 自研移动端 UI 薄壳 + 自有 JSON 内容格式（预留 Anki 导出）。**

---

## 1. 调研方法与数据来源

### 1.1 检索式（GitHub search API，2026-10-26）

| 检索词 | 目的 | 代表命中 |
| --- | --- | --- |
| `spaced repetition flashcards` | 通用 SRS/闪卡 | anki、ts-fsrs 生态、carden、Skill-Anything |
| `flashcards spaced repetition` | Web/移动闪卡 | flashcards.github.io、LearnKit、true-recall |
| `背单词` | 中文背单词形态 | word-wind、fishword、cigen |
| `vocabulary app` | 词汇类 App | flashcards-open-source-app、WordWise、vocabhub |
| `flashcards react` | 前端实现参考 | react-quizlet-flashcard、StudyFlow、StudyMD |
| `anki srs` | Anki 生态/互操作 | anki-apkg-export、Tidme、Anki_Ultimate_Everything |

### 1.2 数据获取限制（如实记录）

- 未认证 GitHub core API 限额 60 次/小时，调研中途触发 403；关键仓数据在限额恢复后补齐，部分非关键仓仅保留 search 结果字段。
- 未逐行审计每个仓库源码；「可复用点」基于 README/仓库描述与公开架构信息，标注「待验证」的即未做源码级确认。
- stars 为抓取瞬间值（示例：ankitects/anki 约 3.2 万；ts-fsrs 835；word-atlas 1,485）。

---

## 2. 候选总表

### 2.1 间隔重复算法库（核心复用对象）

| Repo | Stars | License | 语言 | 最近 push | 可复用模块 | 复用方式 | 主要风险 |
| --- | ---: | --- | --- | --- | --- | --- | --- |
| [open-spaced-repetition/ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs) | 835 | MIT | TypeScript | 2026-10-25 | FSRS-3~7 调度器、四档评分、学习步骤、参数、预演 API | **npm 依赖（采用）** | 版本升级导致 Card 字段/默认参数变化；v6 beta API 不同 |
| [open-spaced-repetition/fsrs4anki](https://github.com/open-spaced-repetition/fsrs4anki) | 4,118 | MIT | Jupyter | 2026-08-14 | FSRS 原理解释、参数训练/优化流程、复习日志格式 | 参考（不直接运行） | Notebook 形态，非生产库；参数训练成本高 |
| [open-spaced-repetition/py-fsrs](https://github.com/open-spaced-repetition/py-fsrs) | 517 | MIT | Python | 2026-08-09 | 服务端调度/离线分析 | 参考（后续服务端同步可用） | 与 TS 实现需版本对齐 |
| [open-spaced-repetition/go-fsrs](https://github.com/open-spaced-repetition/go-fsrs) | 154 | MIT | Go | 2026-10-25 | 高并发服务端调度 | 参考（当前不需要） | 多语言实现参数漂移 |
| [open-spaced-repetition/fsrs-rs](https://github.com/open-spaced-repetition/fsrs-rs) | 454 | BSD-3-Clause | Rust | 2026-10-22 | Anki 内置 FSRS 的 Rust 实现/优化器绑定 | 参考 | Web 端需 WASM，体积与构建复杂 |
| [open-spaced-repetition/free-spaced-repetition-scheduler](https://github.com/open-spaced-repetition/free-spaced-repetition-scheduler) | 730 | MIT | — | 2026-04-21 | DSR 模型的免费调度器/论文配套 | 参考 | 需自行实现集成层 |
| [VienDinhCom/supermemo](https://github.com/VienDinhCom/supermemo) | 337 | MIT | TypeScript | 2025-03-28 | SuperMemo SM-2 的 JS/TS 实现 | 备选（若不用 FSRS） | SM-2 效果弱于 FSRS，无短期步骤/参数化 |

**结论**：ts-fsrs 是唯一同时满足「MIT、TypeScript、活跃、API 完整、与 Anki 算法同源」的库，直接作为依赖。

### 2.2 完整应用（不 fork，作为形态与交互参考）

| Repo | Stars | License | 语言/栈 | 最近 push | 可借鉴 | 不采用原因 |
| --- | ---: | --- | --- | --- | --- | --- |
| [ankitects/anki](https://github.com/ankitects/anki) | 约 3.2 万 | **AGPL-3.0-or-later**（API 标 NOASSERTION，LICENSE 原文确认） | Rust + Python(Qt) | 2026-10-26 | 调度/队列/学习步骤/四档评分/统计口径 | 许可证传染；桌面技术栈；体量大 |
| [ankidroid/Anki-Android](https://github.com/ankidroid/Anki-Android) | 12,098 | **GPL-3.0** | Kotlin/Java | 2026-10-26 | 移动端学习流、手势、安全区、离线存储 | 许可证；Android 原生，Web 不可复用 |
| [designfuchen/word-atlas](https://github.com/designfuchen/word-atlas) | 1,485 | 代码 **MIT** / 数据 **CC BY 4.0**（API 字段 NOASSERTION，README 双许可） | React 19 + Vite + ts-fsrs + WebGL2 | 2026-10-26 | 最接近的「ts-fsrs + 移动端薄壳」实现：今日学习、词卡、本地进度、导出恢复、目标记忆率 | 雅思插画/音频内容管线 + WebGL 图鉴重；内容 CC BY 4.0 需署名；无 Agent 文本卡场景 |
| [h16nning/skola](https://github.com/h16nning/skola) | 55 | **AGPL-3.0** | React + Dexie + FSRS.js | 2026-07-12 | local-first PWA、IndexedDB、可选 Dexie Cloud 同步架构 | AGPL；FSRS.js 非 ts-fsrs；体量小 |
| [RealKai42/qwerty-learner](https://github.com/RealKai42/qwerty-learner) | 23,551 | **GPL-3.0** | React + TypeScript | 2026-09-08 | 中文背单词量级最大的 Web 项目：词库、听写、键盘交互、UI | GPL 不可取码；偏键盘肌肉记忆，SRS 不是核心 |
| [airingursb/miemie](https://github.com/airingursb/miemie) | 488 | **无 LICENSE** | 微信小程序 JS | 2023-12-15（停更） | 「微信小程序背单词」形态与页面流程 | 无许可证、停更，不可复用代码 |
| [st3v3nmw/obsidian-spaced-repetition](https://github.com/st3v3nmw/obsidian-spaced-repetition) | 2,594 | MIT | TypeScript + Obsidian API | 2026-10-05 | Markdown 卡片解析、复习队列、SRS 设置 UI | 依附 Obsidian 插件生态；非独立 App |
| [alyssaxuu/carden](https://github.com/alyssaxuu/carden) | 491 | MIT | JavaScript | **2022-06-17（停更）** | 卡片翻转、gamification 视觉 | 停更 4 年；无 PWA/FSRS；数据模型简单 |
| [heygsc/word-wind](https://github.com/heygsc/word-wind) | 325 | **无 LICENSE** | TypeScript | 2026-08-05 | 中文背单词流程、移动端布局 | 无许可证不可复制代码；需联系作者 |
| [jesselau76/cigen](https://github.com/jesselau76/cigen) | 189 | MIT | JavaScript | 2026-02-25 | 词根词缀式内容组织、记忆法展示 | 面向英语词汇，不是通用 SRS 壳 |
| [flashcards/flashcards.github.io](https://github.com/flashcards/flashcards.github.io) | 184 | MIT | HTML/JS | 2026-02-28 | Markdown 内容→闪卡、开发者题库组织 | 社区内容站形态，非学习闭环 |
| [ctrlaltwill/LearnKit](https://github.com/ctrlaltwill/LearnKit) | 183 | MIT | TypeScript + Obsidian | 2026-10-17 | 笔记→卡片、复习/测试双模式 | Obsidian 依赖；无移动端 PWA |
| [kirill-markin/flashcards-open-source-app](https://github.com/kirill-markin/flashcards-open-source-app) | 101 | MIT | TypeScript（iOS/Mac/Android/Web） | 2026-10-26 | 跨端闪卡产品形态、AI 辅助制卡 | 多端原生工程重；后端/账号耦合需审计 |
| [pieralukasz/true-recall](https://github.com/pieralukasz/true-recall) | 65 | NOASSERTION | TypeScript + Obsidian | 2026-10-26 | FSRS v6 集成、保留率分析、图像遮挡 | 许可证不明；Obsidian 绑定 |
| [artcc/freelingo](https://github.com/artcc/freelingo) | 208 | **AGPL-3.0** | JavaScript | 2026-10-24 | AI 语言学习/复习产品设计 | AGPL；语言学习垂类，架构重 |
| [Chenggou1/fishword](https://github.com/Chenggou1/fishword) | 141 | **GPL-3.0** | TypeScript | 2026-08-05 | CLI 背单词、等待时间复习 | GPL；CLI 形态不符 |
| [helloworld1/AnyMemo](https://github.com/helloworld1/AnyMemo) | 159 | **GPL-2.0** | Java/Android | 2026-05-28 | 老牌 Android SRS 交互 | GPL；原生 Android |
| [KuanKongy/StudyFlow](https://github.com/KuanKongy/StudyFlow) | 138 | MIT | React + Node + MongoDB + Auth0 | 2026-09-17 | 协作学习/AI 摘要 UI | 重后端 + 账号体系，MVP 不需要 |
| [ABSanthosh/react-quizlet-flashcard](https://github.com/ABSanthosh/react-quizlet-flashcard) | 121 | 无 | TypeScript | 2026-06-04 | 卡片翻转组件实现参考 | 无许可证；仅组件 |

**中文「背单词」项目观察**：word-wind / fishword / cigen 证明「单词卡 + 复习」的移动端心智成立，但都没有 FSRS 级调度与可复用许可证；适合借鉴流程与文案，不适合直接取代码。

### 2.3 UI / 组件参考

| Repo | 用途 | 借鉴点 |
| --- | --- | --- |
| [ABSanthosh/react-quizlet-flashcard](https://github.com/ABSanthosh/react-quizlet-flashcard) | 翻转卡片组件 | 翻转动画、正反面布局（仅参考，不复制） |
| [alyssaxuu/carden](https://github.com/alyssaxuu/carden) | 卡片视觉 | 卡片层级、颜色与 gamification（仓库停更） |
| [ankidroid/Anki-Android](https://github.com/ankidroid/Anki-Android) | 移动端学习页 | 单手评分区、进度、安全区、手势（GPL，仅参考交互） |

### 2.4 内容互操作

| Repo | Stars | License | 能力 | 用法 |
| --- | ---: | --- | --- | --- |
| [repeat-space/anki-apkg-export](https://github.com/repeat-space/anki-apkg-export) | 182 | MIT | 浏览器端生成 Anki `.apkg` | V2 导出（需评估 zip/媒体处理体积） |
| [kerrickstaley/genanki](https://github.com/kerrickstaley/genanki) | 2,740 | MIT | Python 生成 Anki 牌组 | V2 服务端批量导出/内容流水线 |
| [ankimcp/anki-mcp-server](https://github.com/ankimcp/anki-mcp-server) | 535 | MIT | MCP 操作 Anki | 未来「AI 制卡→Anki」工作流参考 |
| [jotron/StudyMD](https://github.com/jotron/StudyMD) | 119 | MIT | Markdown→闪卡（Electron） | Markdown 卡片解析参考（停更 2018） |

---

## 3. 推荐方案对比

| 维度 | A. ts-fsrs + 自研薄壳（推荐） | B. fork 现成 Web 闪卡应用 | C. Taro/uni-app 小程序优先 | D. Anki 插件/牌组 |
| --- | --- | --- | --- | --- |
| 开发量 | 低-中（~1.5–2k 行 + 内容） | 中-高（拆后端/改数据模型） | 中（UI/存储重写） | 低（但形态受限） |
| 许可证 | 全部 MIT/Apache | 需逐个审计（部分无证/AGPL） | 取决于模板 | AGPL（Anki 本体） |
| 移动端/PWA | 原生支持，可安装可离线 | 需另做 PWA | 小程序内体验好，无 PWA | 依附 Anki 客户端 |
| 三端 | 浏览器三端 + 可套壳 | 取决于项目 | 微信 + H5 | 仅 Anki 生态 |
| 可控性/可维护 | 高（代码少、边界清晰） | 低（继承历史包袱） | 中 | 低（受 Anki API 限制） |
| 主要风险 | 算法库升级、移动端细节 | 依赖腐化、许可证 | 存储/DOM 差异、审核 | 无法独立分发 |
| 结论 | **V1 采用** | 仅当要做多用户社区时重评 | **Phase 2 备选** | 不采用 |

**补充：`word-atlas` 是 A 方案的现成验证**——同样的 React 19 + Vite + ts-fsrs + 本地优先思路已经在 1,485★ 项目里跑通；但 fork 它需要拆掉雅思内容管线（插画/音频/WebGL 图鉴）并整体换成 Agent 文本卡，收益低于按它的模式自研。因此列为「参考实现」，不列入复用对象。

---

## 4. 复用模块与接入方式

### 4.1 ts-fsrs 实测（2026-10-26）

- 安装：`npm i ts-fsrs@5.4.2`（npm latest；`6.0.0-beta.15` 为 DefaultScheduler 新 API，**不作为稳定依赖**）。
- 运行时版本：`FSRSVersion` 输出 `v5.4.2 using FSRS-6.0`。
- 关键导出：
  - `createEmptyCard(now?) -> Card`
  - `generatorParameters(partial?) -> FSRSParameters`
  - `fsrs(params?) -> FSRS`；`fsrs.repeat(card, now) -> 以 Rating 为键的 {card, log} 集合`；`fsrs.next(card, now, grade) -> {card, log}`
  - `Rating = { Manual:0, Again:1, Hard:2, Good:3, Easy:4 }`
  - `State = { New:0, Learning:1, Review:2, Relearning:3 }`
- `Card` 字段：`due, stability, difficulty, elapsed_days, scheduled_days, learning_steps, reps, lapses, state, last_review?`。
- **弃用字段**：`Card.elapsed_days`、`ReviewLog.elapsed_days/last_elapsed_days` 在 5.4.2 已标 `@deprecated`（6.0.0 移除）；CardState 可持久化兼容，但业务逻辑不要依赖它。
- **体积**：零运行时依赖；`dist/index.mjs` 61,245 B → gzip 13,468 B（对 500KB 首屏预算几乎无影响）。
- **其他可用 API**：`rollback(card, log)`（撤销上一张）、`forget(card, now, reset_count)`（重置进度，实测 state→New、reps/lapses=0）、`reschedule(card, reviews)`、`get_retrievability`；`repeat()` 返回值可迭代，适合做四档间隔预览。
- Hard=6 分钟不是随机：`learning_steps ['1m','10m']` 下 step1 规则为 again=1m / hard=6m / good=10m（d.ts 注释）。
- 默认参数：`request_retention 0.9`、`maximum_interval 36500`、`enable_fuzz false`、`enable_short_term true`、`learning_steps ['1m','10m']`、`relearning_steps ['10m']`、`w` 为 21 个 FSRS-6 参数。
- 新卡实测结果：

| 评分 | 到期 | 状态 |
| --- | --- | --- |
| Again | 1 分钟后 | Learning |
| Hard | 6 分钟后 | Learning |
| Good | 10 分钟后 | Learning |
| Easy | 8 天后 | Review |

**接入建议**：用 `src/lib/scheduler.ts` 薄适配层隔离 ts-fsrs（DB 中存 epoch ms，不存 Date），并实现 Anki 式 **learn-ahead 20 分钟**，否则 Good 后 10 分钟才到期会让用户以为评分无效。

### 4.2 内容互操作

- V1：自有 JSON（deck/card）为 canonical；Anki 仅作为导出目标。
- V2：`anki-apkg-export`（浏览器端）或服务端 `genanki` 生成 `.apkg`；TSV（Front/Back/Tags）成本最低，先做 TSV。
  - `anki-apkg-export@5.0.0` 实测硬约束：MIT、**engines Node >=22.12**、依赖 `jszip` + `sql.js`（浏览器需单独提供 `sql-wasm.wasm`）、只导出 legacy `collection.anki2` 包，且仅对 Anki 26.09.3 做过导入测试；**不支持反向解析 `.apkg`**。V2 建议先 TSV，再评估 APKG。
- 不建议双向同步 Anki（媒体、模板、调度状态映射复杂，错误面大）。

### 4.3 可直接搬用的交互概念（非代码）

1. 四档评分（Again/Hard/Good/Easy）与 FSRS 一一对应；
2. 学习步骤 `1m/10m` + learn-ahead 窗口；
3. 到期优先 + 新卡限额 + 复习限额；
4. 会话小结（本次张数/正确率/下次到期）；
5. 连续天数与每日目标（背单词 App 的留存机制）；
6. 卡片原子化与「最小信息原则」。

---

## 5. 风险清单与规避

| # | 风险 | 影响 | 规避 |
| --- | --- | --- | --- |
| R1 | 许可证传染（AGPL/GPL/无证） | 法律风险、无法闭源 | 只依赖 MIT/Apache/BSD；AGPL/GPL 仅参考交互，不复制代码；无证项目不取代码 |
| R2 | ts-fsrs 版本/参数漂移 | 复习节奏变化、数据不兼容 | 锁 `^5.4.2`；适配层隔离；升级跑调度快照测试；不混用 SM-2 与 FSRS 状态 |
| R3 | 时区/日界 | 「今天」错位、连续天数/限额错误 | 本地日界函数（非 UTC）；DB 存时间戳；单测覆盖 23:59/00:01 |
| R4 | Service Worker 缓存陈旧 | 用户看不到新版本 | `autoUpdate` + 更新提示；版本号可查；发布递增版本 |
| R5 | IndexedDB 被清理 | 学习记录丢失 | `storage.persist()`、导出备份提醒、Phase 2 云同步 |
| R6 | 停更依赖（carden/StudyMD 等） | 安全/兼容问题 | 不引入停更项目代码；依赖最小化 |
| R7 | 无许可证项目 | 无法合规复用 | 仅阅读借鉴，不复制；需要时联系作者 |
| R8 | 内容事实错误 | 信任受损 | 每卡 `source` 必填；抽检；建立报错入口 |
| R9 | 小程序移植返工 | 排期风险 | 域逻辑纯 TS、无 DOM；存储接口化；UI 与 core 分离 |
| R10 | 首屏体积 | 移动端流失 | 内容懒加载/代码分割；bundle 预算 500KB gzip |

---

## 6. 对产品/架构的输入

- **数据模型**：`Deck{id,title,description,version,cards[]}` + `Card{id,type,question,answer,choices?,answerIndex?,explanation?,tags,difficulty,source}` + `CardState`（FSRS Card 字段 + deckId/introducedOn/leech）+ `ReviewLog`（append-only）。
- **卡型**：qa / mcq / cloze 三种足够覆盖概念、辨析、填空；不需要 V1 就做模板引擎。
- **调度**：FSRS-6 + 默认参数；UI 四档评分；learn-ahead 20 分钟；每日新卡/复习上限。
- **架构**：PWA + 本地 IndexedDB + 内容随包；域逻辑纯 TS；同步 Phase 2。
- **内容**：3 个 deck（基础/面试/后训练）各约 28 张，qa≈70%/mcq≈20%/cloze≈10%；source 可核验。

---

## 7. 附录：抓取记录与未核实项

### 7.1 抓取命令（示例）

```powershell
$h=@{'User-Agent'='agent-flashcards-research';'Accept'='application/vnd.github+json'}
Invoke-RestMethod "https://api.github.com/search/repositories?q=spaced+repetition+flashcards&sort=stars&order=desc&per_page=20" -Headers $h
Invoke-RestMethod "https://api.github.com/repos/open-spaced-repetition/ts-fsrs" -Headers $h
npm view ts-fsrs version
```

### 7.2 原始数据（关键仓，2026-10-26）

| Repo | Stars | License | Language | pushed_at |
| --- | ---: | --- | --- | --- |
| ankitects/anki | 约 3.2 万 | AGPL-3.0-or-later（LICENSE 原文） | Rust | 2026-10-26 |
| ankidroid/Anki-Android | 12,098 | GPL-3.0 | Kotlin | 2026-10-26 |
| open-spaced-repetition/fsrs4anki | 4,118 | MIT | Jupyter Notebook | 2026-08-14 |
| kerrickstaley/genanki | 2,740 | MIT | Python | 2024-12-30 |
| st3v3nmw/obsidian-spaced-repetition | 2,594 | MIT | TypeScript | 2026-10-05 |
| open-spaced-repetition/ts-fsrs | 835 | MIT | TypeScript | 2026-10-25 |
| open-spaced-repetition/free-spaced-repetition-scheduler | 730 | MIT | — | 2026-04-21 |
| ankimcp/anki-mcp-server | 535 | MIT | TypeScript | 2026-10-22 |
| open-spaced-repetition/py-fsrs | 517 | MIT | Python | 2026-08-09 |
| alyssaxuu/carden | 491 | MIT | JavaScript | 2022-06-17 |
| open-spaced-repetition/fsrs-rs | 454 | BSD-3-Clause | Rust | 2026-10-22 |
| heygsc/word-wind | 325 | 无 LICENSE | TypeScript | 2026-08-05 |
| VienDinhCom/supermemo | 337 | MIT | TypeScript | 2025-03-28 |
| repeat-space/anki-apkg-export | 182 | MIT | TypeScript | 2026-10-21 |
| kirill-markin/flashcards-open-source-app | 101 | MIT | TypeScript | 2026-10-26 |

### 7.3 未核实/局限

- **仅由 search 结果、未逐仓核验的条目**：cigen、fishword、LearnKit、true-recall、react-quizlet-flashcard、StudyFlow、StudyMD、Skill-Anything 等；其中 true-recall 的 API license 为 NOASSERTION，react-quizlet-flashcard 未见 LICENSE 文件。引用时应视为「search 结果级证据」。
- `flashcards-open-source-app` 的「iOS/Mac/Android/Web」来自仓库描述，具体构建栈未核实。
- 部分仓库的 `pushed_at`、README 细节未逐一抓取（受 API 限额影响），表中已标注或省略。
- 未做源码级安全审计（依赖漏洞、供应链风险）；引入 npm 依赖前应跑 `npm audit`。
- 小程序（Taro）方案未做 PoC，落地前需验证存储与包体限制。
- GitHub stars 仅代表热度，不代表质量；结论基于许可证、活跃度、架构匹配度综合判断。
