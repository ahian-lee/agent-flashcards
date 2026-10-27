# Agent 闪卡 · 开发计划与交付清单

> 版本：v1.0（2026-10-26）  
> 关联：[产品设计](01-product-design.md) · [架构设计](02-architecture.md) · [GitHub 调研](research/github-repos.md)

---

## 0. 交付物对照（需求 → 产出）

| 需求 | 产出 | 位置 | 状态 |
| --- | --- | --- | --- |
| GitHub 调研（候选 repo、对比） | 调研报告：候选总表、分类详评、许可证与风险 | `docs/research/github-repos.md` | 见报告 |
| 推荐复用方案（架构/选型依据） | 复用结论 + 架构分层 + 技术选型表 | `docs/02-architecture.md` | 完成 |
| 内容与功能设计 | 产品设计：页面、卡型、题库组织、学习流程 | `docs/01-product-design.md` | 完成 |
| 记忆曲线/复习机制 | FSRS-6 参数、四档评分、队列、learn-ahead、日界、统计口径 | `docs/02-architecture.md` §5 | 完成 |
| 开发步骤拆解 | 本文 §1–§7（里程碑、任务、验收、命令） | `docs/03-dev-plan.md` | 完成 |
| 可运行 MVP（加分项/落地验证） | 移动优先 PWA 应用 + 80 张卡 | `app/`、`content/` | 见 `app/README.md` |

---

## 1. 里程碑总览

| 里程碑 | 内容 | 估时（人日） | 产出/验收 |
| --- | --- | --- | --- |
| M0 调研与选型 | GitHub 调研、许可证审计、ts-fsrs 验证、技术选型 | 0.5 | 调研报告 + ADR（本套文档） |
| M1 数据与内容规范 | 卡片 schema、校验脚本、3 个 deck 样张 | 0.5 | JSON schema + 校验通过 |
| M2 学习闭环 | 首页、学习页、FSRS 调度、队列、持久化 | 2.0 | 可完整学完 1 个 deck，刷新不丢 |
| M3 移动端与 PWA | 响应式、安全区、深浅色、manifest/SW、安装与离线 | 1.0 | 375px 无横滚；离线可用 |
| M4 统计/设置/数据 | 统计页、设置项、导入导出、重置 | 1.0 | 导入导出往返一致 |
| M5 内容生产与 QA | 3×28 张卡、事实抽检、单测、E2E、构建 | 2.0 | 测试全绿、构建通过 |
| M6 发布 | 静态托管、Lighthouse、README/隐私说明 | 0.5 | 可访问 URL/安装包 |
| V2 同步与小程序 | 账号/同步、Anki 互导、Taro 小程序 | 5–8 | 按 Phase 2 设计 |

> 单人节奏约 1.5–2 周；本仓库并行分工见 §6。

---

## 2. M0 调研与选型（0.5 天）

### 任务

- [x] GitHub 检索：SRS 算法库、闪卡/背单词应用、PWA 模板、Anki 互操作；
- [x] 候选评分：stars、license、活跃度、技术栈、可复用模块、风险；
- [x] `ts-fsrs` 实际安装与 API 验证（5.4.2 / FSRS-6，四档调度实测）；
- [x] 许可证审计：AGPL/GPL 项目仅参考，MIT/Apache 可依赖；
- [x] 决策：ts-fsrs + 自研薄壳 + Dexie + PWA；不 fork Anki/AnkiDroid。

### 验收

- 调研报告含 ≥ 8 个候选、对比表、明确结论与不选原因；
- 每个数据（stars/license）可回溯到 GitHub 页面/API；
- ts-fsrs 版本与 API 记录在案。

### 命令

```powershell
# GitHub 搜索（未认证限流 10 次/分钟）
Invoke-WebRequest "https://api.github.com/search/repositories?q=spaced+repetition+flashcards&sort=stars&order=desc&per_page=20" -Headers @{ 'User-Agent'='agent-flashcards-research' }
# 安装验证
npm view ts-fsrs version
```

---

## 3. M1 数据与内容规范（0.5 天）

### 任务

- [x] 定义 `Deck` / `Card` / `CardState` / `ReviewLog` / `Settings` / `ExportBundle` 类型；
- [x] 定义卡片 JSON schema：qa/mcq/cloze 必填字段、id 规则、difficulty、source；
- [x] 写内容校验脚本：JSON 可解析、id 唯一、mcq 4 选项、cloze 含 `{{c1::}}`、卡数范围；
- [x] 3 个 deck 样张（每 deck ≥ 2 张）保证开发不阻塞；
- [x] 内容写作规范（原子化、最小信息、source 必填、手机长度）。

### 验收

- `node scripts/check-content.mjs`（或 npm script）对 3 个 deck 通过；
- 故意破坏字段（如 mcq 少一个选项）能被检出；
- 类型与文档一致。

---

## 4. M2 学习闭环（2 天）

### 任务

- [x] Vite + React + TS 工程初始化；CSS 变量与基础布局；
- [x] Dexie 数据层：`cardStates` / `reviewLogs` / `settings` / `meta`，事务写入；
- [x] `scheduler.ts` 适配 ts-fsrs：`newCard`、`schedule`、`preview`；
- [x] `queue.ts`：到期 → 学习中 → 新卡；每日上限；deck 过滤；learn-ahead；
- [x] 首页：今日进度、连续天数、deck 列表、开始学习；
- [x] 学习页：qa 翻面、mcq 判分、cloze 揭示、四档评分、进度条、会话小结；
- [x] 评分后写库（状态 + 日志同一事务）；刷新恢复；
- [x] 边界：队列空、跨天、时钟回拨、DB 写失败提示。

### 验收（手工 + 单测）

- [ ] 首次打开 → 学 5 张 → 刷新 → 进度保留；
- [ ] 新卡点「记得」后，learn-ahead 在本次会话末尾再次出现；
- [ ] 点「忘了」后卡在几分钟内重新出现；
- [ ] 每日新卡上限生效（设置改 2 → 只出 2 张新卡）；
- [ ] 队列空显示小结；
- [x] `npm run test` 中 scheduler/queue/dates 用例通过（本次 7 文件 / 83 用例）。

---

## 5. M3 移动端与 PWA（1 天）

### 任务

- [x] 375px 适配、安全区、点击目标 ≥ 44px、无横向滚动；
- [x] 深浅色（auto/light/dark）+ `prefers-reduced-motion`；
- [x] 桌面键盘：Space 翻面、1–4 评分、Esc 返回；
- [x] manifest（名称/图标 192/512/standalone/主题色）；
- [x] Service Worker 预缓存 + `navigateFallback` + 更新提示；
- [x] 图标生成脚本；`apple-touch-icon`；
- [x] `navigator.storage.persist()` 与备份提醒。

### 验收

- [ ] Lighthouse：Installable + Offline 通过（或手工等价验证）；
- [ ] 断网后二次打开可用；
- [ ] iOS Safari 添加到主屏无布局错位（有条件时手测）；
- [ ] 深色模式下对比度合格。

---

## 6. M4 统计/设置/数据（1 天）

### 任务

- [x] 统计页：总数/已掌握/今日/7 天柱状/每 deck 进度/准确率；
- [x] 设置页：新卡上限、复习上限、每日目标、learn-ahead、主题；
- [x] 导出 JSON（`version=1`，含 settings/cardStates/reviewLogs）；
- [x] 导入 JSON：校验、预览、事务合并、失败提示、导入前备份；
- [x] 重置进度：二次确认 + 建议先导出；
- [x] 关于页：FSRS 说明、评分含义、隐私声明。

### 验收

- [ ] 导出 → 重置 → 导入 → 状态/日志/设置恢复一致；
- [ ] 坏文件（截断/错字段/超大）被拒绝且原数据不变；
- [ ] 设置项立即生效并持久化。

---

## 7. M5 内容生产与 QA（2 天）

### 任务

- [x] 3 个 deck × 28 张卡（qa/mcq/cloze 配比、难度分布）；
- [x] 事实抽检：每 deck 抽 5 张核对 source；
- [x] 单测：scheduler/queue/dates/validate/stats；
- [x] E2E：375px 学习闭环、刷新持久化、离线、导出导入；
- [x] `npm run build` + `npm run preview` 冒烟；
- [x] README（运行/部署/数据/已知限制）。

### 验收

- [ ] 内容校验 0 错误；id 无重复；
- [ ] 单测全绿；
- [ ] E2E 冒烟通过（截图/日志为证）；
- [ ] `dist/` 可静态托管，刷新不 404。

---

## 8. M6 发布（0.5 天）

### 任务

- [x] 选择静态托管（Cloudflare Pages / Vercel / Netlify / 对象存储）；
- [x] 配置 `base`（子路径部署时）；
- [x] 隐私说明与「本地数据」提示；
- [x] 版本号（`package.json` + 设置页展示）；
- [x] 备份/导出提醒。

### 验收

- [ ] 公网可访问，手机可安装；
- [ ] 更新发布后用户能收到刷新提示；
- [ ] 回滚方案：保留上一版本静态产物。

---

## 9. 任务拆解（可直接建 issue）

| # | 任务 | 依赖 | 验收 | 建议负责人 |
| --- | --- | --- | --- | --- |
| T1 | 内容 schema + 校验脚本 | - | 坏数据可检出 | 内容/前端 |
| T2 | 3 个 deck 内容（28×3） | T1 | 校验通过 + 抽检 | 内容 |
| T3 | 工程脚手架 + 路由 + 样式系统 | - | dev 可跑 | 前端 |
| T4 | Dexie 数据层 + 迁移测试 | T3 | 事务/刷新持久化 | 前端 |
| T5 | scheduler 适配层 + 单测 | T3 | 四档单调 | 前端 |
| T6 | 队列 + learn-ahead + 单测 | T4/T5 | 上限/窗口正确 | 前端 |
| T7 | 首页 | T4/T6 | 计数正确 | 前端 |
| T8 | 学习页三种卡型 + 评分 | T5/T6 | 闭环可学 | 前端 |
| T9 | 统计页 | T4 | 7 天/掌握度正确 | 前端 |
| T10 | 设置 + 导入导出/重置 | T4 | 往返一致 | 前端 |
| T11 | PWA manifest/SW/图标 | T3 | 可安装/离线 | 前端 |
| T12 | 移动端适配/深色/键盘 | T8 | 375px 无横滚 | 前端 |
| T13 | E2E 冒烟 | T7–T12 | 通过并留档 | QA |
| T14 | 构建/部署/README | T13 | 公网可用 | 全栈 |
| T15 | 事实抽检与内容修订 | T2 | 每 deck 5 张核对 | 内容 |

---

## 10. 本次并行分工（Agent Teams 执行记录）

| 角色 | 范围 | 产出 |
| --- | --- | --- |
| Lead | 产品/架构/开发计划文档、集成、验收 | `docs/01–03`、根 `README.md`、集成与测试证据 |
| repo-scout | GitHub 调研（只写 `docs/research/`） | `docs/research/github-repos.md` |
| content-writer | 3 个 deck（只写 `content/`） | `content/decks/*.json`、`content/README.md` |
| app-builder | PWA 应用（只写 `app/`） | `app/`、`app/README.md` |

写作用域互不重叠；Lead 负责最终集成（同步内容 → 构建 → 测试 → 截图）。

---

## 11. 验证命令（交付时执行）

```powershell
# 1) 内容校验（204 卡）
node content/scripts/validate-decks.mjs

# 2) 应用：安装、单测、构建、预览
cd app
npm install
npm test                  # Vitest：7 文件 / 83 用例
npm run build             # sync-content + tsc -b + vite build
npm run preview           # http://127.0.0.1:4173

# 3) E2E 冒烟（系统 Chrome，不需要下载浏览器）
npm run smoke             # 51 项断言，截图落 app/.smoke
```

```powershell
# 手动冒烟
# 1) 打开 http://127.0.0.1:4173
# 2) 首页应显示 3 个 deck、今日进度、开始学习
# 3) 进入学习 → 翻面 → 四档评分 → 进度条前进
# 4) 刷新页面 → 今日已学不归零
# 5) 设置 → 导出 → 重置（二次确认）→ 导入 → 恢复
```

---

## 12. 上线后迭代（V2 优先级）

1. 云同步（Supabase/D1）+ 多端登录；
2. Anki TSV 导入导出；
3. 标签筛选/自定义组卷/面试冲刺模式；
4. 卡片报错/暂停/收藏；
5. AI 拆卡生产流水线（人工审核）；
6. 微信小程序（Taro 复用 core）；
7. Web Push / 服务号提醒。

---

## 13. 风险与回滚

| 场景 | 处理 |
| --- | --- |
| 新版本调度异常 | 保留旧静态产物，秒级回滚；scheduler 快照测试 |
| 内容事实错误 | 热修 JSON（cardId 不变），发布新版本；用户状态不受影响 |
| 用户数据丢失 | 导出备份 + 导入恢复；Phase 2 云同步；设置页常驻备份提醒 |
| SW 卡旧版本 | autoUpdate（下次加载接管）+ 发布版本号；保留上一版静态产物 |
| 小程序移植失败 | 不影响 PWA；core 接口已隔离，可只保留 PWA |

---

## 14. 完成定义（DoD）

一个里程碑完成需同时满足：

- [x] 代码/内容合并，`npm run test` + `npm run build` 通过；
- [x] 对应验收项逐条勾选并留证据（命令输出/截图）；
- [x] 文档同步更新（架构/README/内容规范）；
- [x] 无 P0/P1 缺陷；P2 缺陷登记并排期（见 §15）。

---

## 15. 本次交付实测结果（2026-10-27）

| 验证项 | 命令/证据 | 结果 |
| --- | --- | --- |
| 内容 schema | `node content/scripts/validate-decks.mjs` | 204 卡通过（8 deck）；id 全局唯一；qa/mcq/cloze = 20/5/3（Agent 卷）与 17/4/3（LLM 卷） |
| 单元测试 | `cd app && npm test` | 7 files / **83 passed**，0 failed |
| 生产构建 | `cd app && npm run build` | 成功；JS 472.23KB（gzip 155.54KB）、CSS 20.2KB（gzip 4.58KB）、precache 16 项 500.94KB |
| 冒烟（375×812 @2x） | `cd app && npm run smoke` | **51/51 passed**，0 console error |
| 预览服务 | `http://127.0.0.1:4173/` | 200；`/sw.js`、`/manifest.webmanifest`、icons 均 200 |
| 截图 | `docs/screenshots/` | 首页、学习正反面、cloze、mcq、统计、深色设置、会话小结、离线 |
| 设计文档 | `docs/01–03` + `docs/research/github-repos.md` | 完成 |

已知限制（详见 `app/README.md` §10）：全局每日上限而非每 deck；3D 翻面要求固定卡高、超长答案卡内滚动；进度主键为 `deckId::cardId`，改 id 会产生孤儿进度；无多端同步；统计页全量加载 reviewLogs；iOS 存储可能被系统回收；SW 需 https/localhost。
