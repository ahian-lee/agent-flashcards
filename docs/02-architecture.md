# Agent 闪卡 · 架构与技术设计

> 版本：v1.0（2026-10-26）  
> 关联：[产品与内容设计](01-product-design.md) · [GitHub 调研](research/github-repos.md) · [开发计划](03-dev-plan.md)

---

## 0. 结论摘要

1. **不自研调度算法**：复用 [`ts-fsrs`](https://github.com/open-spaced-repetition/ts-fsrs)（MIT，npm latest 5.4.2，FSRS-6）。它由 open-spaced-repetition 社区维护，是 Anki 生态同源算法的 TypeScript 实现，自带四档评分、短期学习步骤、可训练参数。
2. **不 fork 完整应用**：Anki 桌面端（Rust，AGPL-3.0）、AnkiDroid（Kotlin，GPL-3.0）技术栈与许可证都不适合 Web/移动端二次开发；现有 React/Next.js 闪卡项目多绑定服务端与账号体系，改造成本高于自研薄壳。
3. **UI 自研但只做薄壳**：页面少（4 个）、交互简单（翻面 + 四档评分），用 React + 原生 CSS 即可，控制依赖与 bug 面；交互模式参考 Anki/AnkiDroid 的成熟做法（学习步骤、learn-ahead、四档评分）。
4. **数据本地优先**：Dexie(IndexedDB) 存用户状态，内容随包；JSON 导入导出兜底跨设备；Phase 2 再接同步服务。
5. **三端预留**：纯 TS 域逻辑（`app/src/lib/`）与 UI 解耦，后续 Taro 可复用至微信小程序；Capacitor 可套壳上架。
6. **内容可互操作**：canonical JSON → 可导出 Anki TSV（V2）；不直接绑定 Anki 的 `.apkg`。

---

## 1. 开源复用评估（摘要）

> 完整候选、stars、许可证、最近提交与逐项风险见 [research/github-repos.md](research/github-repos.md)。以下为架构决策所需结论。

### 1.1 四类复用对象

| 类别 | 代表项目 | 许可证 | 对本项目的价值 | 采用方式 |
| --- | --- | --- | --- | --- |
| 调度算法库 | `open-spaced-repetition/ts-fsrs` | MIT | FSRS-6 完整实现，四档评分、短期步骤、参数可调 | **npm 依赖**（核心） |
| 完整应用 | `ankitects/anki`、`ankidroid/Anki-Android` | AGPL-3.0 / GPL-3.0 | 调度与交互的权威参考 | **仅参考**，不引入代码 |
| Web 闪卡应用 | `alyssaxuu/carden` 等 | MIT | 卡片 UI、PWA 思路 | 参考，不 fork |
| 内容工具/格式 | Anki TSV/APKG、`genanki` | MIT/AGPL(工具) | 内容导入导出 | V2 互操作 |

### 1.2 为什么不用 Anki 本体/AnkiDroid

- **许可证**：Anki 桌面端 AGPL-3.0、AnkiDroid GPL-3.0，若修改后通过网络分发/上架，源码开放义务与商业闭源不兼容；
- **技术栈**：Anki 核心为 Rust + Python(Qt)，AnkiDroid 为 Kotlin/Java，Web 端无法复用 UI；移植成本高于重写；
- **形态不匹配**：Anki 是通用工具，学习曲线陡，内容组织、首页、面试模式都需要重做。

### 1.3 为什么不用现成 Web 闪卡项目 fork

- 多数 Next.js 项目绑定 Postgres/Prisma/NextAuth，MVP 只需本地存储，砍掉后端等于重写；
- 依赖树大、版本旧，移动端细节（安全区、PWA、手势）仍需打磨；
- 自研薄壳约 1.5–2k 行，可控性与可维护性更好。
- **最接近的参考实现**：`designfuchen/word-atlas`（1,485★，代码 MIT + 数据 CC BY 4.0，React 19 + Vite + ts-fsrs + WebGL2，本地优先无账号）已跑通「ts-fsrs + 移动端薄壳 + 本地进度」，但其雅思插画/音频与 WebGL 图鉴管线与 Agent 文本卡不匹配，fork 后仍需整体替换内容层，故只借鉴架构与交互。
- 例外：若后续要做多用户/社区，可重新评估 fork 一个 MIT 的 Next.js 闪卡项目，但需先做许可证与依赖审计。

### 1.4 复用边界与风险

| 复用模块 | 复用方式 | 风险 | 规避 |
| --- | --- | --- | --- |
| ts-fsrs 调度 | `import { fsrs, createEmptyCard, Rating }` | 版本升级导致 Card 字段/默认参数变化；v6 beta API 不同 | 锁 `^5.4.2`；adapter 隔离；升级前跑调度快照测试 |
| FSRS 参数 | 用默认 FSRS-6 参数（retention 0.9） | 不同用户最佳 retention 不同 | V1 固定；V2 暴露 0.8–0.95 + 可选参数训练 |
| Dexie | npm 依赖 | schema 升级/迁移 bug；多标签页并发 | 版本化 schema；每版本写迁移测试；评分前读最新状态 |
| vite-plugin-pwa | npm 依赖 | SW 缓存旧版本导致「更新不生效」 | `registerType: autoUpdate` + `cleanupOutdatedCaches` + 版本号/发布记录；预缓存策略 |
| Anki 交互模式 | 参考（学习步骤/learn-ahead/四档） | 照搬 Anki 复杂行为导致用户困惑 | 只保留 20 分钟 learn-ahead，不暴露 leech 自动暂停 |

---

## 2. 技术选型

### 2.1 选型表

| 层 | 选择 | 理由 | 备选与否决原因 |
| --- | --- | --- | --- |
| 构建 | Vite 8 + TypeScript（项目锁 8.x，以 `package-lock.json` 为准） | 快、零配置、静态产物易托管 | Next.js：需要 SSR/后端，MVP 用不上 |
| UI | React 19 | 生态成熟、团队熟悉、组件化 | Vue/Svelte：可，但无收益；原生 JS：状态管理易乱 |
| 样式 | 原生 CSS + CSS 变量 | 无额外构建、体积小、深浅色简单 | Tailwind：多一层构建与类名噪音；UI 库：移动端定制成本高 |
| 路由 | 自写 hash 路由（或 react-router 轻量） | 页面少，避免 History API 在静态托管的 404 配置 | react-router 也可，按实现复杂度选 |
| SRS | ts-fsrs 5.4.2（FSRS-6） | 复用成熟算法，MIT | 自研 SM-2：效果差、易错；自研 FSRS：重复造轮子 |
| 存储 | Dexie 4（IndexedDB，Apache-2.0） | 事务、索引、迁移、类型支持好 | localStorage：容量/同步性问题；SQLite(WASM)：体积大 |
| PWA | vite-plugin-pwa（Workbox） | manifest/SW 预缓存开箱即用 | 手写 SW：缓存策略易错 |
| 测试 | Vitest + Testing Library + Playwright | 与 Vite 同源；移动端冒烟 | Jest：配置成本高 |
| 部署 | 任意静态托管（Cloudflare Pages/Vercel/Netlify/OSS） | 纯静态、免运维 | 自建服务器：无必要 |

### 2.2 版本与兼容

- Node ≥ 20（构建）；目标浏览器 ES2020+；
- 锁文件提交（`package-lock.json`）；
- `ts-fsrs` 固定 `^5.4.2`，不上 6.x beta；
- 构建产物 base 可配置（`BASE_PATH=/repo/ npm run build`），适配子路径部署。

---

## 3. 架构分层

```
┌──────────────────────────────────────────────────────────┐
│ UI（React）— app/src/pages + components                   │
│  pages: Home / Study / Stats / Settings                  │
│  components: CardView / RatingBar / RichText / Progress  │
│  hooks: useAsyncData（lib/store.ts）                      │
└───────────────▲──────────────────────────┬───────────────┘
                │ props / 事件              │ 读写
┌───────────────┴──────────────────────────▼───────────────┐
│ app/src/lib（纯 TS 域逻辑 + 本地存储）                     │
│  scheduler.ts  ts-fsrs 适配：newCard/schedule/preview     │
│  queue.ts      队列：到期 → 新卡 → learn-ahead            │
│  dates.ts      本地日界、streak、近 7 天                  │
│  content.ts    deck/card 解析 + 校验 + 派生 uid           │
│  importExport.ts  导入校验/合并                           │
│  db.ts         Dexie 读写（cardStates/reviewLogs/settings）│
│  stats.ts      掌握度、准确率、每日计数                   │
└───────────────▲──────────────────────────┬───────────────┘
                │                          │
┌───────────────┴──────────┐   ┌───────────▼───────────────┐
│ content/（随包静态）      │   │ IndexedDB（Dexie v1）     │
│ decks/*.json + index.ts   │   │ cardStates / reviewLogs   │
│ sync-content.mjs 同步     │   │ settings                  │
└──────────────────────────┘   └───────────────────────────┘
```

**关键约束（实际实现）**：

- `lib/` 中除 `db.ts` 外不依赖 React/DOM（scheduler、queue、dates、content、importExport、stats 均为纯函数，单测覆盖）；
- 存储集中在 `lib/db.ts`（Dexie）；UI 通过 `recordReview / loadStateMap / ...` 调用；
- 无全局状态库：`lib/store.ts` 用变更通知 + `useAsyncData` 重新拉取；
- V2 抽 `StateStore` 接口（见 §8/§13），以便 Taro/小程序替换存储实现；V1 不为抽象而抽象。

---

## 4. 数据模型

### 4.1 内容（只读，随包）

```ts
type CardType = 'qa' | 'mcq' | 'cloze';

interface Card {
  id: string;                 // 全局唯一，如 "basics-001"；发布后不复用
  type: CardType;
  question: string;           // qa/mcq 题干；cloze 含 {{c1::...}}
  answer: string;             // 答案（Markdown 子集）
  choices?: [string, string, string, string]; // mcq 必填
  answerIndex?: 0 | 1 | 2 | 3;                // mcq 必填
  explanation?: string;       // 解析/易错点
  tags: string[];
  difficulty: 1 | 2 | 3;
  source: string;             // 论文/官方文档，可核验
}

interface Deck {
  id: string;                 // 如 "agent-basics"（与文件名一致）
  title: string;
  description: string;
  version: number;            // 内容版本，用于迁移/提示
  updatedAt: string;          // YYYY-MM-DD
  cards: Card[];
}
```

示例（qa）：

```json
{
  "id": "basics-004",
  "type": "qa",
  "question": "ReAct 的核心思想是什么？",
  "answer": "**Reasoning + Acting**：让模型交替产生推理轨迹（Thought）与动作（Action），再根据环境返回的观察（Observation）继续推理，直到给出最终答案。\n\n- 优点：可解释、能调用外部工具、比纯 CoT 更少事实错误\n- 代价：多轮调用带来 token 与延迟开销；需要工具结果格式稳定",
  "explanation": "ReAct 不是「先想完再做」，而是「想一步、做一步、看结果再想」。",
  "tags": ["ReAct", "规划"],
  "difficulty": 2,
  "source": "Yao et al., ReAct: Synergizing Reasoning and Acting in Language Models, arXiv:2210.03629"
}
```

### 4.2 用户状态（实际实现）

```ts
// app/src/lib/scheduler.ts —— 直接映射 ts-fsrs Card，日期用 number(epoch ms) 存储
interface CardStateRecord {
  cardId: string;             // 主键，格式 `${deckId}::${cardId}`，如 agent-basics::basics-001
  deckId: string;
  due: number;                // epoch ms
  stability: number;
  difficulty: number;
  elapsed_days: number;       // ts-fsrs 5.x 兼容字段；5.4.2 已标 deprecated（6.0 移除），业务逻辑勿依赖
  scheduled_days: number;
  learning_steps: number;
  reps: number;
  lapses: number;
  state: 0 | 1 | 2 | 3;       // New/Learning/Review/Relearning
  last_review: number | null; // epoch ms；从未复习为 null
}

// app/src/lib/scheduler.ts —— 每次评分追加一条
interface ReviewLogRecord {
  cardId: string;
  deckId: string;
  cardType: string;           // qa/mcq/cloze
  rating: number;             // 1–4
  prevState: number;
  prevDue: number;
  due: number;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  learning_steps: number;
  review: number;             // epoch ms（真实发生时间）
  day: string;                // 本地日 YYYY-MM-DD（统计口径）
  correct: boolean;           // qa/cloze 用 rating!==Again；mcq 用选项是否答对
  mode: string;
}

// app/src/lib/settings.ts
interface Settings {
  newPerDay: number;          // 默认 20（全局，不是每 deck）
  reviewPerDay: number;       // 默认 200
  learnAheadMinutes: number;  // 默认 20
  theme: 'auto' | 'light' | 'dark';
}
```

> 设计稿中的 `introducedOn / leech / updatedAt / dailyGoal / contentVersion` 未进入 V1 实现：新卡计数与连续天数从 `reviewLogs` 实时聚合；「每日目标」由 `newPerDay + min(dueNow, reviewPerDay)` 派生，不单独存储。`leech`、多端同步用的 `updatedAt` 留到 Phase 2。

### 4.3 Dexie schema（实际实现）

```ts
db.version(1).stores({
  cardStates: 'cardId, deckId, due, state, last_review',
  reviewLogs: '++id, cardId, deckId, day, review',
  settings: 'key',            // 单行：key = 'app'
});
```

- `cardStates` 用 `cardId` 作主键（`deckId::cardId`），`due`/`state` 用于队列；
- `reviewLogs` 自增主键 append-only，`day` 用于统计与每日上限；
- 评分写入走 `db.transaction('rw', cardStates, reviewLogs, ...)`，状态与日志同事务；
- 不在 IndexedDB 存卡片正文（内容随包），避免内容升级与状态错位。

### 4.4 导出/导入文件（实际实现）

```ts
interface ExportPayload {
  app: 'agent-flashcards';
  version: 1;                  // 导出格式版本，导入时校验 <= 1
  exportedAt: number;          // epoch ms
  settings: Settings;
  cardStates: CardStateRecord[];
  reviewLogs: ReviewLogRecord[];
}
```

导入规则（`app/src/lib/importExport.ts`）：

1. 校验 `app === 'agent-flashcards'`、`version <= 1`、字段类型；时间戳接受 epoch ms / 数字字符串 / ISO 字符串；非法条目跳过并计数（`skipped`），整体结构无效则拒绝并提示；
2. 以 `cardId` 合并：比较 `last_review`，较新者胜；日志按内容去重后 union；
3. 未知 cardId（内容已下线）保留在库里但不进入队列；
4. 设置经 `clampSettings` 归一化后合并；
5. 全程事务；UI 会显示「新增/更新/保留较新/复习记录」数量。

---

## 5. 间隔重复（FSRS）设计

### 5.1 为什么选 FSRS 而不是 SM-2

- SM-2（SuperMemo 2）只有 ease factor，无法区分「难度」与「稳定性」，对遗忘曲线的拟合弱；
- FSRS 基于 DSR（Difficulty-Stability-Retrievability）模型，用 21 个参数拟合真实复习日志，Anki 自 23.10 起内置，社区大规模验证；
- ts-fsrs 提供 `repeat()` 预演四档结果，可直接在 UI 显示「下次复习：N 天」，实现「可解释」。

### 5.2 参数（V1 固定）

```ts
import { fsrs, generatorParameters, createEmptyCard, Rating, State } from 'ts-fsrs';

const params = generatorParameters({
  request_retention: 0.9,       // 目标保持率 90%
  maximum_interval: 36500,      // 上限 100 年（Anki 默认）
  enable_fuzz: false,           // 确定性，便于测试
  enable_short_term: true,      // 保留学习步骤
  learning_steps: ['1m', '10m'],
  relearning_steps: ['10m'],
});
const scheduler = fsrs(params);
```

实测（ts-fsrs 5.4.2，新卡）：
| 评分 | 下次到期 | 状态 |
| --- | --- | --- |
| Again | 1 分钟后 | Learning |
| Hard | 6 分钟后 | Learning |
| Good | 10 分钟后 | Learning |
| Easy | 8 天后 | Review |

> V2 可在设置中暴露 `request_retention`（0.8–0.95）与「优化参数」（需要复习日志，`@open-spaced-repetition/binding`），V1 不做以免引入 WASM 体积与训练复杂度。

### 5.3 适配层（唯一接触 ts-fsrs 的地方）

```ts
// app/src/lib/scheduler.ts
import { createEmptyCard, fsrs, generatorParameters, Rating, State } from 'ts-fsrs';
import type { Card, CardState, RatingValue } from './types';

const f = fsrs(generatorParameters({ /* 上节参数 */ }));

const toFsrsCard = (s: CardState) => ({
  due: new Date(s.due),
  stability: s.stability,
  difficulty: s.difficulty,
  elapsed_days: s.elapsed_days,
  scheduled_days: s.scheduled_days,
  learning_steps: s.learning_steps,
  reps: s.reps,
  lapses: s.lapses,
  state: s.state,
  last_review: s.last_review ? new Date(s.last_review) : undefined,
});

export function schedule(s: CardState, rating: RatingValue, now: Date) {
  const { card, log } = f.next(toFsrsCard(s), now, rating);
  return {
    state: {
      ...s,
      due: +card.due,
      stability: card.stability,
      difficulty: card.difficulty,
      elapsed_days: card.elapsed_days,
      scheduled_days: card.scheduled_days,
      learning_steps: card.learning_steps,
      reps: card.reps,
      lapses: card.lapses,
      state: card.state,
      last_review: card.last_review ? +card.last_review : undefined,
      leech: card.lapses >= 4,
      updatedAt: +now,
    },
    log: { ...log, rating, reviewedAt: +now },
  };
}

export function preview(s: CardState, now: Date) {
  // 返回 [{rating: 'again', due, label: '1 分钟'}, ...]，用于评分按钮下的小字
}
```

- `newCardState(cardId, deckId)`：`createEmptyCard()` + 业务字段；
- 其他可用 API：`rollback(card, log)`（撤销上一张）、`forget(card, now, reset_count)`（重置进度）、`reschedule(card, reviews)`、`get_retrievability`；`repeat()` 返回可迭代的四档结果，适合做评分按钮下的间隔预览；
- ts-fsrs 零运行时依赖，ESM 61KB / gzip 13.5KB，对首屏预算影响很小；
- 所有日期在边界转换，DB 中永远存 number；
- 单测覆盖：四档单调性（再次 < 困难 < 记得 < 简单）、Again 拉回、Easy 长间隔、非法评分拒绝、时钟回拨。

### 5.4 本地日界与连续天数

```ts
export const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const startOfLocalDay = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
```

- **不按 UTC 切日**（否则东八区 08:00 前算前一天）；
- 连续天数：取 `reviewLogs.day` 去重倒序，从「今天」或「昨天」开始连续计数（今天还没学不应断签）；
- 近 7 天柱状图按本地日 key 聚合；
- 跨 0 点学习：日志按实际发生时间归属当天；UI 在日界变化时重新计算「今日」。

### 5.5 队列算法

```
buildQueue(now, scope: deckId | 'all', store):
  1. 读 settings；today = dayKey(now)
  2. dueCards = 所有 state != New 且 state != Learning/Relearning 且 due <= now
  3. learningCards = state ∈ {Learning, Relearning} 且 due <= now
  4. newCards = 无 state 的卡（受 remainingNew = dailyNewLimit - todayIntroduced 限制）
  5. reviewLimit = dailyReviewLimit - todayReviewed(非新卡)
  6. 队列 = dueCards(按 due 升序，截断 reviewLimit)
          + learningCards(按 due 升序)
          + newCards(按 deck 顺序/难度，截断 remainingNew)
  7. 打乱 newCards 以避免同主题连续（可选）
  8. 返回 { queue, summary }
```

**Learn-ahead（关键）**：普通队列耗尽后，若存在 `Learning/Relearning` 且 `due <= now + learnAheadMinutes`，追加到队尾（最多 20 分钟窗口），确保「新卡点记得 → 10 分钟后同会话内再出现一次」，而不是让用户以为没生效。

**评分后重排**：

- 评分写入后立即从队列移除当前卡；
- 若评分为 Again 且新状态 Learning/Relearning 的 due 在窗口内，插到队尾（learn-ahead 处理）；否则不进队列；
- 队列长度实时更新；进度 = 已完成 / (已完成 + 剩余)。

**首页计数**：

- 待复习 = `due <= now`（严格口径）；
- 10 分钟内到期 = `now < due <= now + 10min`（提示用）；
- 新卡剩余 = `dailyNewLimit - todayIntroduced`；
- 不在首页暴露「积压」负值，用「还有 N 张到期」文案。

### 5.6 统计口径

| 指标 | 口径 |
| --- | --- |
| 今日已学 | 今天 `reviewLogs` 条数（含新卡与复习） |
| 今日新卡 | `reviewLogs` 中 `stateBefore = New` 的条数 |
| 准确率 | 今日 `rating >= 3` 的占比 |
| 已掌握 | `state = Review && (reps >= 3 || stability >= 21)`（展示用） |
| 连续天数 | 有日志的连续本地日 |
| 近 7 天 | 按 `day` 聚合日志数 |

---

## 6. 关键流程

### 6.1 学习一张卡

```
用户进入 /study
  → buildQueue()
  → 渲染队首卡（qa 显示问题；mcq 显示选项；cloze 显示挖空）
  → 用户翻面/选择
  → 选择评分（mcq 可自动预选）
  → core.scheduler.schedule(state, rating, now)
  → store.transaction: putState + addLog
  → 队列前移；若队列空 → 触发 learn-ahead 检查 → 否则会话小结
  → 小结：本次 N 张、正确率、各档间隔预览、返回首页
```

### 6.2 App 启动

```
main.tsx
  → 读 settings（缺省则初始化）
  → 幂等：所有内容卡片有 state 或视为 New（不预写，按需创建）
  → 应用主题（settings.theme；auto → prefers-color-scheme；index.html 内联脚本防闪烁）
  → 渲染首页
```

### 6.3 导出/导入

```
导出：读 settings + cardStates + reviewLogs → ExportPayload → Blob 下载
      （文件名 agent-flashcards-YYYYMMDD.json；提示「备份含学习记录，妥善保存」）
导入：选择文件 → 读文本 → JSON.parse → 结构校验（app/version/字段类型/非法条目跳过）
      → 事务合并 → Toast 显示「新增 X / 更新 Y / 保留较新 Z / 复习记录 N」
```

---

## 7. PWA 与离线

- `vite-plugin-pwa`（实际配置见 `app/vite.config.ts`）：
  - `registerType: 'autoUpdate'` + `skipWaiting: true` + `clientsClaim: true` + `cleanupOutdatedCaches: true`：新版本在下次加载时接管，无需用户点确认；代价是更新不弹窗提示，靠版本号与发布记录感知；
  - `workbox.globPatterns` 预缓存 JS/CSS/HTML/图标/字体（内容 JSON 已被打包进 JS，随构建版本更新）；
  - `navigateFallback: 'index.html'`，离线刷新不 404；
- manifest：`name: 'Agent 闪卡'`、`short_name: 'Agent闪卡'`、`display: standalone`、`theme_color: '#4f46e5'`、`background_color: '#0b1220'`、`start_url: base`、`orientation: portrait`、icons 192/512/maskable；
- iOS：`apple-mobile-web-app-capable`、`status-bar-style`、`apple-touch-icon`；Safari 添加到主屏后独立窗口；
- 缓存策略：
  - 预缓存：构建产物 + 内容（随包，更新随版本）；
  - 运行时：不请求后端（V1 无网络请求），因此离线 == 在线；
- 数据持久化：`navigator.storage.persist()`（支持时申请），降低被系统清理概率；设置页显示存储占用并提供「导出备份」提醒。

---

## 8. 多端与同步（Phase 2 设计，V1 不实现）

### 8.1 目标

同一账号在手机/桌面继续学习；离线优先；冲突可解释、可恢复。

### 8.2 推荐方案

**Supabase（Postgres + Auth + RLS）** 或 **Cloudflare Workers + D1**，二选一：

| 维度 | Supabase | Cloudflare D1 |
| --- | --- | --- |
| 上手 | 快（托管 Postgres/Auth） | 中（需写 Worker API） |
| 成本 | 免费额度足够 MVP | 低 |
| 国内访问 | 一般 | 一般（可换国内云） |
| 适合 | 快速验证 | 已有 Cloudflare 体系 |

### 8.3 表结构

```sql
create table card_states (
  user_id uuid not null,
  card_id text not null,
  deck_id text not null,
  due bigint not null,
  stability real not null,
  difficulty real not null,
  elapsed_days int not null,
  scheduled_days int not null,
  learning_steps int not null,
  reps int not null,
  lapses int not null,
  state smallint not null,
  last_review bigint,
  introduced_on date not null,
  leech boolean not null default false,
  updated_at bigint not null,
  primary key (user_id, card_id)
);

create table review_logs (
  id uuid primary key,
  user_id uuid not null,
  card_id text not null,
  deck_id text not null,
  rating smallint not null,
  state_before smallint not null,
  reviewed_at bigint not null,
  day date not null,
  duration_ms int,
  clock_skew boolean not null default false
);
```

### 8.4 合并规则

1. **状态**：按 `(user_id, card_id)` upsert，`updated_at` 较大者胜（LWW）；服务端在写入时用 `server_time` 校正客户端时钟偏差（记录 offset）；
2. **日志**：append-only，按 `id` 去重；冲突不合并（日志是事实）；
3. **删除/退役卡**：`tombstones(user_id, card_id, deleted_at)`，同步后本地删除状态；
4. **首次登录**：本地数据全量 push（带 `client_id`），服务端已有数据则按规则合并；
5. **离线队列**：本地 outbox 表记录待同步变更，联网后按序重放；失败指数退避；
6. **隐私**：只同步学习状态，不同步导出文件；提供「删除云端数据」。

> V1 存储已集中在 `app/src/lib/db.ts`；Phase 2 引入 `StateStore` 接口 + `RemoteStore` 组合（本地写 + outbox），UI 不变。

---

## 9. 内容管线

```
content/decks/*.json
   │  node content/scripts/validate-decks.mjs   （schema + id 唯一 + 卡型规则 + 卡数；CI 门禁）
   ▼
app/scripts/sync-content.mjs   （遍历目录 → 复制到 src/content/decks + 生成 index.ts；缺失/损坏回退 fallback）
   ▼
app/src/content/  →  Vite 构建打包（内容进入 JS bundle）  →  PWA 预缓存
```

- 校验脚本独立于构建（`npm run build` 会先 sync，但对缺失内容容错并回退 3 个兜底 deck）；CI 建议先跑 validator，失败则阻断发布；
- 内容版本随构建产物整体更新，无单独的 meta hash；
- 卡片 ID 稳定；删除卡片时 V2 可在 `content/retired.json` 登记，App 忽略但保留状态；
- 新增 deck：把 JSON 放进 `content/decks/`，sync 脚本自动遍历并生成 import，无需改 UI。

---

## 10. 安全、隐私与可访问性

### 10.1 安全

- 内容为随包静态数据（可信），但导入 JSON 不可信：按字段重建对象（不直接合并原始对象）、类型/范围归一化、非法条目跳过并计数；V1 未设文件大小上限（受浏览器内存约束），V2 可加 20MB/50k 条限制；
- Markdown 渲染：自写轻量渲染器（列表/粗体/行内代码/代码块/链接），**不使用 `dangerouslySetInnerHTML`**，React 节点级渲染；
- 无远端请求（V1），无第三方脚本，CSP 可收紧（`default-src 'self'`）；
- 导出文件含学习记录（不含密钥），提示用户妥善保管。

### 10.2 隐私

- 本地优先，无账号、无分析 SDK、无网络上报；
- 设置页「重置学习进度」= 清空 IndexedDB 中的 cardStates / reviewLogs / settings（二次确认）；SW 缓存在浏览器「清除站点数据」时一并清除；
- Phase 2 同步默认关闭，开启需明确同意，提供导出与删除。

### 10.3 可访问性

- 语义化按钮/标题；焦点可见；`aria-live` 播报翻面/评分结果；
- 颜色对比 ≥ 4.5:1（深浅色两套校验）；
- 触摸目标 ≥ 44×44px；字体随系统缩放不破版；
- 键盘：Space 翻面、1–4 评分、Esc 返回；
- `prefers-reduced-motion: reduce` 时关闭翻面/滑动动画。

---

## 11. 测试与质量

### 11.1 单元测试（Vitest）

| 模块 | 用例 |
| --- | --- |
| scheduler | 四档间隔单调；Again 回 Learning；Easy 进 Review；非法评分抛错；日期往返 |
| queue | 到期优先；新卡上限；review 上限；deck 过滤；learn-ahead 窗口；队列空 |
| dates | 本地日界（23:59/00:01）、跨月/跨年、闰年、streak（今天未学不断签） |
| validate | 合法/非法 deck；mcq 选项数；cloze 标记；导入 bundle 版本/字段/超限 |
| stats | 掌握度、准确率、7 天聚合 |

### 11.2 组件/集成

- Testing Library：CardView 三种卡型渲染与交互（11 个用例）；
- 纯函数测试覆盖导入校验/合并（`importExport.ts`）与内容 schema（`content.ts`），无需 fake-indexeddb。

### 11.3 E2E 冒烟（Playwright，系统 Chrome）

`app/scripts/smoke-preview.mjs`（`npm run smoke`）实际执行 51 项断言：

- 375×812 @2x：首页 3 deck、无横向滚动、触摸目标 ≥44px、底部 3 tab；
- 学习：翻面 → 四档评分（1m/6m/10m/8d）→ 进度推进；空格翻面 + 数字键评分；cloze 挖空揭晓；mcq 判对错 + 解析；
- 持久化：评分写入 IndexedDB（7 条）→ 刷新仍 7 条；
- 统计页四项指标 + 近 7 天 7 根柱；
- 导出 JSON → 导入回导成功（新增 0 / 更新 7）→ 重置二次确认 → cardStates=0；
- PWA：manifest 字段、SW activated、断网刷新仍可用；无控制台错误。

### 11.4 手工验收

- iOS Safari 添加到主屏、独立窗口打开、安全区（需真机，本次未执行）；
- Android Chrome 安装提示（需真机，本次未执行）；
- 深色模式（截图验证）、系统字体放大 200%（未执行）；
- Lighthouse PWA 检查（需 Chrome DevTools，本次用 manifest/SW/离线断言替代）。

### 11.5 发布前检查清单（本次结果）

- [x] `npm run test`：7 文件 / 83 用例通过；`npm run build`：成功，JS 472KB / gzip 155.5KB，precache 16 项 500.9KB
- [x] 8 个 deck 内容校验通过（204 卡，id 唯一），事实抽检（arXiv 标题/官方 URL/专题章节）
- [x] 导出/导入往返一致（冒烟实测）
- [x] 离线二次访问正常（SW 预缓存，冒烟实测）
- [x] 375px 无横向滚动；桌面居中
- [x] README/隐私说明/算法说明可见（app/README.md、设置页「关于」）

### 11.6 本次实测结果（2026-10-27）

| 检查 | 命令 | 结果 |
| --- | --- | --- |
| 内容校验 | `node content/scripts/validate-decks.mjs` | 204 卡全部通过（8 deck） |
| 单元测试 | `cd app && npm test` | 7 files / 83 passed |
| 构建 | `cd app && npm run build` | 成功；dist 12 文件 / 517.5KB |
| 冒烟 | `cd app && npm run smoke` | 51/51 passed（375×812 @2x） |
| 预览 | `cd app && npm run preview` | 127.0.0.1:4173，200；sw/manifest/icons 200 |

---

## 12. 风险登记册

| # | 风险 | 影响 | 概率 | 缓解 |
| --- | --- | --- | --- | --- |
| R1 | FSRS 版本/API 升级导致调度变化 | 复习节奏漂移 | 中 | 锁 5.4.2；adapter + 快照测试；升级单独 PR |
| R2 | 时区/日界错误导致「今天」错位 | 连续天数/限额错 | 中 | 本地日界函数 + 单测；DB 存时间戳 |
| R3 | SW 缓存旧版本 | 用户看不到更新 | 中 | autoUpdate（下次加载接管）+ 版本号/发布记录；保留上一版产物 |
| R4 | iOS 存储被清理（长期不打开） | 进度丢失 | 中 | `storage.persist()`；导出提醒；Phase 2 云同步 |
| R5 | 导入恶意/超大 JSON | 卡死/污染 | 低 | 严格校验、限大小、白名单、事务 |
| R6 | 内容事实错误 | 信任受损 | 中 | source 必填；抽检；用户报错入口（V2） |
| R7 | 新卡积压导致放弃 | 留存下降 | 中 | 上限 + 积压提示 + 拆解建议 |
| R8 | 评分通胀（总点「太简单」） | 间隔失真 | 中 | 文案引导；统计保持率；V2 校准提示 |
| R9 | 多标签页并发写 | 状态覆盖 | 低 | 评分前读最新状态；Dexie 事务；V2 BroadcastChannel |
| R10 | 单设备假设不满足用户 | 体验缺口 | 中 | V1 明确说明；JSON 迁移；Phase 2 同步 |
| R11 | 小程序移植时存储/DOM 差异 | 返工 | 中 | lib 无 DOM；V2 抽 StateStore 接口；UI 分离 |
| R12 | 依赖体积过大（首屏慢） | 移动端体验 | 低 | ts-fsrs gzip 仅 13.5KB；代码分割、内容懒加载、bundle 预算 500KB |

---

## 13. 可扩展性

- **内容扩展**：新增 JSON deck 自动发现；标签体系支持 V2 组卷；可按 `category` 分组（如「Agent 工程」「模型训练」「产品」）。
- **算法扩展**：`scheduler.ts` 可切换 SM-2/FSRS 参数；保留 `ReviewLog` 即可离线训练参数。
- **端扩展**：`app/src/lib` 纯 TS → Taro 小程序 / Capacitor / RN；V2 存储适配器实现 `StateStore`。
- **同步扩展**：`RemoteStore` 组合 + outbox；服务端只需实现 upsert/pull。
- **内容生产**：AI 拆卡 → JSON → 人工审核 → 自动校验 → 发布；与 Anki TSV 互导。
