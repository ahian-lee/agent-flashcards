# 大模型面经材料识别与「五卷题库书」结构

> 来源页面：<https://programmercarl.com/qita/0022.llminterview.html>（代码随想录 · 2026 最全大模型面经汇总）  
> 实际题目承载页：<https://notes.kamacoder.com/interview/llm/>（卡码笔记 · 大模型面经汇总）  
> 正文抓取：2026-10-27，已落盘到 [`llm-sources/`](llm-sources/)（10 篇专题全文，共约 25 万字符）  
> 识别时间：2026-10-27  
> 关联：[五卷题库实现](#5-五卷题库书设计) · [内容规范](../../content/README.md) · [应用架构](../02-architecture.md)

---

## 0. 重要更正：第一版只用了标题，已废弃

第一版卡片只抓了各专题的 h2 标题，答案是我按标题自行补写，**没有使用正文**，用户已指出这类卡片无效。  
第二版已完整抓取 10 篇专题正文并落盘，每张卡的事实、数字、术语、例子都来自正文对应章节，source 逐卡标注 `§章节号`。  
正文文件（可复核）：

| 文件 | 内容 | 字符数 |
| --- | --- | ---: |
| [agent.txt](llm-sources/agent.txt) | Agent 大厂面试题汇总（12 节） | 37,291 |
| [rag.txt](llm-sources/rag.txt) | RAG 大厂面试题汇总（12 节） | 24,640 |
| [transformer.txt](llm-sources/transformer.txt) | Transformer 原理（8 节） | 23,556 |
| [finetune.txt](llm-sources/finetune.txt) | SFT/RLHF/DPO 面试详解（11 节） | 27,787 |
| [vibe.txt](llm-sources/vibe.txt) | Vibe Coding 大厂面试题（4 节） | 21,610 |
| [cc_deep.txt](llm-sources/cc_deep.txt) | Claude Code 深度解析 | 36,665 |
| [cc_grep.txt](llm-sources/cc_grep.txt) | Claude Code 为什么不用 RAG 检索代码 | 25,761 |
| [cc_ctx.txt](llm-sources/cc_ctx.txt) | Claude Code 上下文窗口 | 24,824 |
| [vibe_pit.txt](llm-sources/vibe_pit.txt) | Vibe Coding 避坑指南 | 13,608 |
| [sdd.txt](llm-sources/sdd.txt) | Spec-Driven Development | 24,527 |

> 正文抓取方式：`fetch` 拉取专题页 HTML → 提取正文区 → 转纯文本落盘；未使用登录态、未批量爬取站点、未复制站点答案。

---

## 1. 材料识别结论

### 1.1 这个 URL 是什么

用户给的页面是**面经汇总索引页**，不是 100+ 道题的正文题库。页面自身只包含：

- 一段导语（大模型面试与后端八股的区别）；
- 五大方向导语：**Agent、RAG、Transformer、模型微调、AI 编程**；
- 若干专题文章链接与宣传图；
- 6 条 FAQ（适合谁、怎么刷、没有项目经验怎么办等）；
- 图片 6 张（页面截图/专题封面，非题目列表）。

真正的题目在它指向的 **卡码笔记专题页**里。索引页原文写「覆盖 7 大方向、15 篇专题面经、100+ 道高频面试题」，而卡码笔记索引页实际列出 **32 个专题/面经链接**（含 7 篇真实面经）。因此本项目的处理方式是：

1. **以索引页的五大方向为纲**（Agent / RAG / Transformer / 微调 / AI 编程）；
2. **进入对应核心专题页提取题目结构**（章节标题、追问点）；
3. **用自己的话写面试答案**（不逐字复制原文），每张卡标注来源 URL；
4. 真实面经与其余 27 篇专题作为 V2 扩展素材，不进入本次五卷。

### 1.2 材料清单

| 材料 | URL | 用途 |
| --- | --- | --- |
| 索引页（用户提供） | https://programmercarl.com/qita/0022.llminterview.html | 五卷方向、页面定位、FAQ |
| 卡码笔记索引 | https://notes.kamacoder.com/interview/llm/ | 32 个专题链接、五大块划分 |
| Agent 专题 | https://notes.kamacoder.com/interview/llm/agent_interview.html | 第 1 卷题目结构 |
| RAG 专题 | https://notes.kamacoder.com/interview/llm/rag_interview.html | 第 2 卷题目结构 |
| Transformer 专题 | https://notes.kamacoder.com/interview/llm/transformer_interview.html | 第 3 卷题目结构 |
| 微调专题 | https://notes.kamacoder.com/interview/llm/finetuning_sft_rlhf_interview.html | 第 4 卷题目结构 |
| AI 编程专题 | https://notes.kamacoder.com/interview/llm/vibe_coding_interview.html | 第 5 卷题目结构 |
| 页面图片 6 张 | `file1.kamacoder.com/i/web/2026-05-19_*.jpg` | 识别为专题文章截图/封面，非题目列表 |
| 章节结构原始数据 | [llm-source-headings.json](llm-source-headings.json) | 5 个专题页 h1–h4 标题抓取结果 |

### 1.3 图片识别结果

下载 6 张图并逐张查看后确认：

- 图 1–5 是 Agent / RAG / Transformer / 微调 / AI 编程专题文章的**正文截图**（如「Workflow vs Agent 控制流对比」「多 Agent 主从通信架构」），不是题目清单；
- 图 6 是真实面经文章截图；
- 图片中的信息（如 Workflow/Agent 控制权对比、多 Agent 异常处理）已被专题页文字覆盖，**无需 OCR 入库**，仅作为结构佐证。

---

## 2. 五大方向与专题文章（32 篇）

> 以下链接来自卡码笔记索引页；本次只对每方向 1 篇核心专题做结构化抽题，其余列为延伸阅读。

### 2.1 Agent 智能体（13 篇）

1. [Agent 大厂面试题汇总](https://notes.kamacoder.com/interview/llm/agent_interview.html)（核心）
2. [Loop 详解：从 ReAct 到 Loop Engineering](https://notes.kamacoder.com/interview/llm/loop_engineering_interview.html)
3. [Graph Engineering 与 Agent 图编排](https://notes.kamacoder.com/interview/llm/graph_engineering_interview.html)
4. [Harness Engineering 面试题](https://notes.kamacoder.com/interview/llm/harness_interview.html)
5. [生产级 Agent 全景](https://notes.kamacoder.com/interview/llm/production_agent_architecture_harness_org_talent.html)
6. [多 Agent 通信与编排](https://notes.kamacoder.com/interview/llm/multi_agent_communication_interview.html)
7. [Multi-Agent Harness](https://notes.kamacoder.com/interview/llm/multi_agent_harness_interview.html)
8. [Agent Harness 可观测性](https://notes.kamacoder.com/interview/llm/agent_harness_observability_interview.html)
9. [Agent Skill](https://notes.kamacoder.com/interview/llm/agent_skill_interview.html)
10. [Agent 框架横评](https://notes.kamacoder.com/interview/llm/agent_framework_comparison.html)
11. [Agent 混合路由优化](https://notes.kamacoder.com/interview/llm/agent_hybrid_routing_interview.html)
12. [Agent 漂移与幻觉](https://notes.kamacoder.com/interview/llm/agent_drift_hallucination_interview.html)
13. [Agent 系统如何约束幻觉](https://notes.kamacoder.com/interview/llm/agent_hallucination_control_interview.html)

### 2.2 RAG 检索增强（3 篇）

1. [RAG 大厂面试题汇总](https://notes.kamacoder.com/interview/llm/rag_interview.html)（核心）
2. [RAG 落地最难的地方](https://notes.kamacoder.com/interview/llm/rag_hardest_parts_interview.html)
3. [GraphRAG 与 LightRAG](https://notes.kamacoder.com/interview/llm/graphrag_interview.html)

### 2.3 Transformer 原理（1 篇）

1. [Transformer 大厂面试题汇总（应用开发者视角）](https://notes.kamacoder.com/interview/llm/transformer_interview.html)（核心）

### 2.4 模型微调（1 篇）

1. [SFT、RLHF、DPO 面试详解](https://notes.kamacoder.com/interview/llm/finetuning_sft_rlhf_interview.html)（核心）

### 2.5 AI 编程（7 篇）

1. [Vibe Coding 大厂面试题汇总](https://notes.kamacoder.com/interview/llm/vibe_coding_interview.html)（核心）
2. [Vibe Coding 避坑指南](https://notes.kamacoder.com/interview/llm/vibe_coding_backup_engineering.html)
3. [Claude Code 大厂面试题](https://notes.kamacoder.com/interview/llm/claude_code_deep_dive.html)
4. [AI 增强开发三件套](https://notes.kamacoder.com/interview/llm/ai_enhanced_development_openspec_superpowers_gstack.html)
5. [Spec-Driven Development](https://notes.kamacoder.com/interview/llm/spec_driven_development_interview.html)
6. [Claude Code 为什么不用 RAG 检索代码](https://notes.kamacoder.com/interview/llm/claude_code_grep_rag_interview.html)
7. [Claude Code 上下文窗口](https://notes.kamacoder.com/interview/llm/claude_code_context_window_interview.html)

### 2.6 真实面经（7 篇，V2 素材）

字节 Agent 四面、字节番茄小说一面、阿里淘天、阿里千问 RAG、快手、百度、美团。链接见卡码笔记索引页；本次不入库，避免与专题题重复。

---

## 3. 核心专题的题目结构（提取结果）

> 以下为各专题页 h2 级章节（即「大问题」），h3/h4 为追问点。完整 h1–h4 见 [llm-source-headings.json](llm-source-headings.json)。

### 3.1 Agent 专题（12 个主问题 + 追问）

1. LLM 和 Agent 有什么区别？（LLM 四大天花板 / Agent 四模块）
2. Agent 和 Workflow 有什么区别？（谁控制流程 / 量化对比 / 混合架构）
3. Agent 有哪些工作模式？（ReAct / Plan-and-Execute / Reflection / Multi-Agent；如何防 ReAct 死循环）
4. Function Call 是什么？底层怎么实现？（四步流程 / 并行调用 / 厂商格式）
5. MCP 是什么协议？解决什么问题？（N×M / 架构 / 能力 / 工具发现 / 安全 / 传输）
6. Skills 是什么？和 Prompt 有什么区别？（激活机制 / 文件结构）
7. Function Call、MCP、Skills 三者区别与协作？
8. A2A 协议是什么？和 MCP 的关系？
9. Agent 的记忆系统怎么设计？（短期/长期 / 压缩 / 读写时机）
10. Agent 的安全与可靠性如何保障？（威胁模型 / 最小权限 / HITL / Prompt Injection / 重试幂等）
11. RAG 和 Agent 是什么关系？（RAG 是工具 / Agentic RAG）
12. 大厂真实追问（系统设计 / 原理深挖 / 工程实践）

### 3.2 RAG 专题（11 个主问题 + 追问）

RAG 是什么/为什么 → 七步链路 → 向量检索原理 → 向量库选型（Milvus/FAISS/Qdrant）→ 纯向量问题与混合检索（RRF）→ Rerank → Chunk 策略 → Embedding 选型 → 幻觉处理 → 检索优化 → Agentic RAG → 大厂追问。

### 3.3 Transformer 专题（7 个主问题 + 追问）

应用开发为何要懂 → 为何绕不开 Transformer（RNN/CNN 困境）→ Self-Attention（Q/K/V）→ Multi-Head → Positional Encoding → Encoder/Decoder/Decoder-Only 选型 → 局限性（O(n²)/外推/Lost in the Middle/串行生成）→ 高频追问。

### 3.4 微调专题（10 个主问题 + 追问）

名词（SFT/RLHF/RL/PPO/DPO）→ 微调 vs Prompt vs RAG 怎么选 → 垂类微调为何被基模抹平 → SFT 破局点（控行为）→ RLHF/RL 破局点（控偏好/决策）→ DPO 为何常被提 → 不建议微调的场景 → 如何判断微调收益 → 面试追问（8 条）→ 面试怎么答。

### 3.5 AI 编程专题（4 个主问题 + 追问）

Vibe Coding 是什么 → 工程师五大优势（问题定义/上下文构建/结果验证/技术决策/成本控制）→ Token 成本控制五策略 → 高频面试题（场景/工程落地）→ Claude Code 专题（Agent Loop / 系统提示词 / 为何用 grep 而非纯 RAG / 上下文压缩）。

---

## 4. 为什么按「方向分卷、专题分层」组织

考虑三种组织方式：

| 方案 | 学习体验 | 问题 |
| --- | --- | --- |
| 按专题混排成一个大 deck | 刷题时主题跳跃 | 不利于「按岗位方向集中突破」 |
| 按方向分卷，卷内按专题排序 | **符合面试准备路径**：先选方向，再按专题刷 | 需要 5 个 deck，首页略长 |
| 按难度分层 | 适合冲刺 | 割裂知识体系，面试追问时接不上 |

**结论：方向分卷 + 卷内专题分层 + 标签可筛选**。每卷 24 张卡，恰好覆盖该方向的核心专题；卷内卡片按专题顺序排列（新卡按内容顺序引入），同一专题的卡片相邻，便于「学完一个专题再下一个」。

---

## 5. 五卷题库书设计

| 卷 | deck id | 标题 | 核心来源 | 卡数 | id 前缀 | 专题标签 |
| --- | --- | --- | --- | ---: | --- | --- |
| 第 1 卷 | `llm-agent` | LLM 面试题库 · Agent 智能体卷 | agent_interview | 24 | `agent-` | LLM/Workflow、ReAct、Function Call、MCP、Skills、A2A、记忆、安全、Agentic RAG |
| 第 2 卷 | `llm-rag` | LLM 面试题库 · RAG 检索增强卷 | rag_interview | 24 | `rag-` | 链路、向量检索、向量库、混合检索、Rerank、Chunk、Embedding、幻觉、Agentic RAG |
| 第 3 卷 | `llm-transformer` | LLM 面试题库 · Transformer 原理卷 | transformer_interview | 24 | `transformer-` | Self-Attention、Multi-Head、位置编码、三大架构、O(n²)、KV Cache、长上下文 |
| 第 4 卷 | `llm-finetuning` | LLM 面试题库 · 模型微调卷 | finetuning_sft_rlhf_interview | 24 | `finetune-` | SFT、RLHF、PPO、DPO、数据、评测、微调取舍、上线 |
| 第 5 卷 | `llm-vibecoding` | LLM 面试题库 · AI 编程卷 | vibe_coding_interview | 24 | `vibe-` | Vibe Coding、五大优势、Token 成本、工程纪律、Claude Code、Spec-Driven |

合计 **120 张新卡**，加入现有 3 个 Agent deck（84 卡）后，题库总计 **8 个 deck / 204 张卡**。

### 5.1 每卷卡型与难度

| 卷 | qa | mcq | cloze | 难度 1/2/3 |
| --- | ---: | ---: | ---: | --- |
| Agent | 17 | 4 | 3 | 7 / 12 / 5 |
| RAG | 17 | 4 | 3 | 7 / 12 / 5 |
| Transformer | 17 | 4 | 3 | 7 / 12 / 5 |
| 微调 | 17 | 4 | 3 | 7 / 12 / 5 |
| AI 编程 | 17 | 4 | 3 | 7 / 12 / 5 |

理由：面试以「能开口讲」为主，qa 占七成；mcq 用于易混淆概念（如 MCP vs A2A、DPO vs RLHF、MHA vs GQA）；cloze 用于公式、流程、术语（如 DPO loss、RAG 七步、Self-Attention 公式）。

### 5.2 卡片与专题的映射（示例）

| 卷 | 卡片区间 | 专题 |
| --- | --- | --- |
| Agent | agent-001–003 | LLM vs Agent、Agent 四模块、Workflow vs Agent |
| Agent | agent-004–006 | ReAct / Plan-and-Execute / Reflection |
| Agent | agent-007–009 | Function Call、并行调用、MCP |
| Agent | agent-010–012 | Skills、Function/MCP/Skills 协作、A2A |
| Agent | agent-013–015 | 记忆分层、压缩、读写时机 |
| Agent | agent-016–018 | 安全、HITL、Prompt Injection |
| Agent | agent-019–021 | RAG 与 Agent、Agentic RAG、失败模式 |
| Agent | agent-022–024 | 真实追问（系统设计/原理/工程） |
| RAG | rag-001–004 | 为什么 RAG、七步链路、向量检索、ANN |
| RAG | rag-005–008 | 向量库选型、混合检索/RRF、Rerank、Chunk |
| RAG | rag-009–012 | Embedding、幻觉、检索优化、Agentic RAG |
| RAG | rag-013–016 | 文档预处理、父子索引、多跳、权限 |
| RAG | rag-017–020 | 评测（召回/忠实度）、失败排查、成本、缓存 |
| RAG | rag-021–024 | 真实追问（检索/工程/场景） |
| Transformer | transformer-001–004 | 为什么懂、RNN/CNN 困境、Self-Attention、Q/K/V |
| Transformer | transformer-005–008 | Multi-Head、位置编码、三大架构、选型 |
| Transformer | transformer-009–012 | O(n²)、KV Cache、MQA/GQA、Lost in the Middle |
| Transformer | transformer-013–016 | 长上下文、外推、训练/推理差异、应用启示 |
| Transformer | transformer-017–020 | 概念/架构/应用追问 |
| Transformer | transformer-021–024 | 易错点与速答 |
| 微调 | finetune-001–004 | 名词、三阶段、SFT 目标、数据格式 |
| 微调 | finetune-005–008 | RLHF、RM、PPO、KL |
| 微调 | finetune-009–012 | DPO、DPO vs RLHF、GRPO、偏好数据 |
| 微调 | finetune-013–016 | 微调 vs Prompt vs RAG、垂类失败、收益评估 |
| 微调 | finetune-017–020 | 不建议微调、上线、回归、成本 |
| 微调 | finetune-021–024 | 公式/超参/追问速答 |
| AI 编程 | vibe-001–004 | Vibe Coding、五大优势、问题定义、上下文构建 |
| AI 编程 | vibe-005–008 | 结果验证、技术决策、成本控制、模型路由 |
| AI 编程 | vibe-009–012 | Token 优化、缓存、任务评估、工程纪律 |
| AI 编程 | vibe-013–016 | Git/备份/回滚/测试、代码审查、安全 |
| AI 编程 | vibe-017–020 | Claude Code（Loop、提示词、grep vs RAG、压缩） |
| AI 编程 | vibe-021–024 | Spec-Driven、场景题、落地题、速答 |

> 实际卡片以作者产出为准；本表是结构与覆盖校验基线。

---

## 6. 制作规则

1. **不逐字复制**：专题页文字受版权保护；卡片用「问题 + 自己的结构化答案」表达，不搬运原文段落。source 标注专题 URL，读者可回原文深挖。
2. **面试答法**：答案先给结论/框架，再给取舍、坑、指标；qa 80–300 字，能直接开口说。
3. **一卡一考点**：不把「MCP 架构 + 安全 + 传输」塞进一张卡；按 h3 追问拆卡。
4. **卡型匹配**：概念对比→mcq；流程/公式/术语→cloze；开放题/系统设计→qa。
5. **来源可核验**：每卡 source 必须含专题 URL；涉及论文公式时追加 arXiv 编号。
6. **ID 稳定**：`卷前缀-三位序号`，发布后不复用；改卡 id 会让用户进度变孤儿。
7. **与现有题库不重复**：现有 `agent-basics` / `agent-interview` / `agent-post-training` 已覆盖的题，不原样重复；新卷侧重「大模型面试专题」视角（如 MCP/A2A/Skills 对比、RAG 七步、Transformer 原理、DPO/RLHF 取舍、Claude Code）。

---

## 7. 入库与验收

### 7.1 文件

```
content/decks/
├── llm-agent.json          # 24 卡，agent-001…024
├── llm-rag.json            # 24 卡，rag-001…024
├── llm-transformer.json    # 24 卡，transformer-001…024
├── llm-finetuning.json     # 24 卡，finetune-001…024
└── llm-vibecoding.json     # 24 卡，vibe-001…024
```

### 7.2 验收命令

```powershell
node content/scripts/validate-decks.mjs   # 8 个 deck / 204 卡全部通过
cd app
npm run sync:content                      # 自动发现 5 个新 deck
npm test                                  # 83 单测
npm run build                             # 构建 + PWA
npm run preview                           # 首页应显示 8 个 deck
npm run smoke                             # 更新为 8 deck 断言后 51+ 项通过
```

### 7.3 学习路径建议

- **Agent 岗**：第 1 卷 → 第 2 卷（RAG 是 Agent 的工具）→ 第 3 卷（被追问原理时兜底）；
- **RAG / LLM 工程岗**：第 2 卷 → 第 3 卷 → 第 4 卷（微调取舍）；
- **算法/微调岗**：第 4 卷 → 第 3 卷 → 第 1 卷；
- **AI 编程 / 全栈**：第 5 卷 → 第 1 卷 → 第 2 卷。

---

## 8. 未纳入与后续

- **真实面经 7 篇**：题目与专题重复度高，且含具体公司/轮次信息；V2 可做「公司面经」独立卷。
- **其余 27 篇延伸专题**：Loop/Graph/Harness/多 Agent/可观测性/Skill/路由/漂移等，适合在五卷之后做「进阶卷」。
- **图片内容**：为正文截图，未做 OCR；如需，可将「Workflow vs Agent 控制流」「多 Agent 主从通信」做成架构图卡片（V2）。
- **版权**：本套卡片为学习用途的**改写与结构化**，不替代原文；转载/商用前请获得原作者授权。
