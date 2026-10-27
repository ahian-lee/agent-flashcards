# Agent 知识卡片内容库（content/）

面向「像背单词一样学 Agent 知识」的移动端问答卡片。当前包含 8 个 deck、共 204 张卡，全部中文，每张卡带可核验出处。

- **Agent 系列**：`agent-basics` / `agent-interview` / `agent-post-training`（各 28 卡）
- **大模型面试系列**：`llm-agent` / `llm-rag` / `llm-transformer` / `llm-finetuning` / `llm-vibecoding`（各 24 卡，来源与五卷划分见 [docs/research/llm-interview-source-map.md](../docs/research/llm-interview-source-map.md)）

## 1. 目录结构

```
content/
├── decks/
│   ├── agent-basics.json          # 基础知识 28 卡（basics-001…028）
│   ├── agent-interview.json       # 面试题库 28 卡（interview-001…028）
│   ├── agent-post-training.json   # 后训练知识 28 卡（posttrain-001…028）
│   ├── llm-agent.json             # 大模型面试·Agent 卷 24 卡（agent-001…024）
│   ├── llm-rag.json               # 大模型面试·RAG 卷 24 卡（rag-001…024）
│   ├── llm-transformer.json       # 大模型面试·Transformer 卷 24 卡（transformer-001…024）
│   ├── llm-finetuning.json        # 大模型面试·微调卷 24 卡（finetune-001…024）
│   └── llm-vibecoding.json        # 大模型面试·AI 编程卷 24 卡（vibe-001…024）
├── scripts/
│   ├── validate-decks.mjs         # schema + 内容规范校验
│   └── shuffle-mcq.mjs            # 打散 mcq 正确答案位置（确定性、可复现）
└── README.md                      # 本文件
```

## 2. Deck Schema（严格遵守）

```json
{
  "id": "agent-basics",            // 必须与文件名（去 .json）一致
  "title": "Agent 基础知识",
  "description": "……",           // 一句话说明范围，会展示在选题页
  "version": 1,                   // 整数，内容不兼容变更时 +1
  "updatedAt": "2026-10-26",      // YYYY-MM-DD
  "cards": [
    {
      "id": "basics-001",         // 前缀 + 三位序号，全局唯一
      "type": "qa",               // qa | mcq | cloze
      "question": "……",          // qa：问题；mcq：题干；cloze：含 {{c1::…}} 的句子
      "answer": "……",            // qa / cloze 必填，Markdown
      "choices": ["A", "B", "C", "D"], // 仅 mcq，恰好 4 项
      "answerIndex": 2,           // 仅 mcq，0–3
      "explanation": "……",       // 解析 / 易错点（mcq 必填）
      "tags": ["ReAct", "规划"],   // 非空数组，用于检索与筛选
      "difficulty": 2,            // 1 易 / 2 中 / 3 难
      "source": "论文标题, arXiv:2210.03629 https://arxiv.org/abs/2210.03629"
    }
  ]
}
```

### 卡型规则

| 类型 | 必填字段 | 约定 |
| --- | --- | --- |
| `qa` | question, answer | 问题 ≤60 字；答案 80–250 字（面试题可到 400），用列表 / 加粗 / 代码块 |
| `mcq` | question, choices（4 项）, answerIndex, explanation | 干扰项要「像真的错」，explanation 必须解释为什么，不写 `answer` |
| `cloze` | question（含 `{{c1::…}}`，可到 `{{c3::…}}`）, answer | 挖空处给答案；answer 写完整句或要点，可不与题面重复 |

## 3. 编写规范

1. **准确性优先**：任何数字、超参、公式必须来自论文或官方文档；不确定就换题，不硬编。出处写「标题 + arXiv 编号 / 官方 URL」，保证能点开核对。
2. **手机扫读**：一问一答，答案先给结论再给分点；每点 1–2 行，避免整段长文。需要时用代码块或 `→` 表示流程。
3. **答案长度**：qa 80–250 字；interview 类 150–400 字，按「思路框架 + 关键取舍 + 落地要点」组织；cloze 答案 40–260 字。
4. **写「易错点」**：`explanation` 用来放最常见误解、面试追问、反模式，而不是复述答案。
5. **公式用纯文本**：写清每个符号（如 β、π_ref、y_w/y_l），避免依赖 LaTeX 渲染；跨行公式用代码块。
6. **配比**：每个 deck 约 qa 70% / mcq 20% / cloze 10%；难度 1/2/3 约 30% / 50% / 20%；卡数 24–30。
7. **id 与前缀**：`basics-`、`interview-`、`posttrain-` + 三位序号；同一 deck 内前缀统一，全局不重复。
8. **只写 content/**：不修改 app/、docs/；新增内容只做加法，不改别人的 deck 结构。

## 4. 选题覆盖表

### agent-basics（28 卡）

| 主题 | 卡片 |
| --- | --- |
| Agent 定义与组成 | basics-001, basics-002 |
| Agent loop / ReAct / 规划 | basics-003, basics-004, basics-005 |
| CoT / ToT | basics-006, basics-007 |
| 工具调用 / Function Calling / 工具设计 | basics-008, basics-009, basics-012 |
| MCP | basics-010, basics-011 |
| 记忆（短期/长期/情景/语义/程序性） | basics-013, basics-014, basics-015 |
| RAG | basics-016, basics-017 |
| 多 Agent（编排者-工作者/辩论/handoff） | basics-018, basics-019, basics-020 |
| 护栏 / HITL | basics-021, basics-022 |
| 评估（成功率/pass^k/LLM-as-judge/轨迹） | basics-023, basics-024, basics-025, basics-026 |
| 成本与延迟 | basics-027 |
| 常见失败模式 | basics-028 |

### agent-interview（28 卡）

| 主题 | 卡片 |
| --- | --- |
| Agent vs Workflow 选型 | interview-001, interview-024, interview-027 |
| 系统设计：客服 / 代码 / 研究 | interview-002, interview-003, interview-004 |
| 工具失败、重试、幂等 | interview-005, interview-006, interview-007, interview-008 |
| 评估体系（离线+在线+人工） | interview-009, interview-021, interview-022 |
| 降幻觉 | interview-010 |
| 长上下文 | interview-011, interview-012 |
| 多 Agent 通信与失败模式 | interview-013, interview-014, interview-026 |
| 线上可观测性与事故排查 | interview-015, interview-016 |
| 安全（prompt injection / Excessive Agency） | interview-017, interview-018, interview-019 |
| 成本与延迟 | interview-020 |
| 工具过多时的选择 | interview-023 |
| 灰度发布与版本管理 | interview-025 |
| 数据飞轮 | interview-028 |

### agent-post-training（28 卡）

| 主题 | 卡片 |
| --- | --- |
| SFT（目标/数据质量） | posttrain-001, posttrain-002, posttrain-003 |
| 奖励模型与 RLHF | posttrain-004, posttrain-005 |
| PPO 与 KL 约束 | posttrain-006, posttrain-007 |
| DPO 及变体（IPO/KTO/ORPO） | posttrain-008, posttrain-009, posttrain-010, posttrain-011 |
| GRPO / DeepSeek-R1 / DAPO | posttrain-012, posttrain-013, posttrain-014, posttrain-015 |
| ORM / PRM | posttrain-016, posttrain-017 |
| reward hacking / verifier | posttrain-018, posttrain-019 |
| RFT / 拒绝采样 / STaR | posttrain-020 |
| 数据清洗与配比 | posttrain-021, posttrain-022 |
| LoRA / QLoRA | posttrain-023, posttrain-024, posttrain-025 |
| 蒸馏 | posttrain-026 |
| 灾难性遗忘 / 冷启动 | posttrain-027, posttrain-014 |
| 评测基准与过拟合 | posttrain-028 |

### llm-agent（24 卡，大模型面试·Agent 卷）

| 专题 | 卡片 |
| --- | --- |
| LLM vs Agent（天花板、四模块） | agent-001, agent-002 |
| Workflow vs Agent（判据、量化、混合） | agent-003, agent-004 |
| ReAct（循环、优缺点、防死循环） | agent-005, agent-006, agent-007 |
| Plan-and-Execute / Reflection | agent-008 |
| Multi-Agent（何时用、坑） | agent-009 |
| Function Calling（本质、四步、并行、厂商格式） | agent-010, agent-011, agent-012 |
| MCP（N×M、架构、能力、传输、安全） | agent-013, agent-014, agent-015, agent-016 |
| Skills vs System Prompt | agent-017 |
| Function Call / MCP / Skills 协作 | agent-018 |
| A2A 与 MCP 的关系 | agent-019 |
| 记忆系统与上下文管理 | agent-020 |
| 安全底线（最小权限 + HITL） | agent-021 |
| RAG 与 Agent / Agentic RAG | agent-022 |
| 企业级 Agent 系统设计 | agent-023 |
| 生产环境高频坑 | agent-024 |

### llm-rag（24 卡，大模型面试·RAG 卷）

| 专题 | 卡片 |
| --- | --- |
| 为什么 RAG | rag-001 |
| RAG 核心思路 | rag-002 |
| 七步链路 | rag-003, rag-004 |
| 向量检索与 HNSW | rag-005, rag-006 |
| 向量库选型 | rag-007, rag-008 |
| 混合检索与 RRF | rag-009, rag-010 |
| Rerank / Bi-Encoder vs Cross-Encoder | rag-011, rag-012 |
| Chunk 与文档类型 | rag-013, rag-014 |
| Embedding 选型 | rag-015, rag-016 |
| 幻觉两类六策 | rag-017, rag-018 |
| 检索排查与高级优化 | rag-019, rag-020 |
| Agentic RAG | rag-021 |
| 权重/Top-K、延迟/索引/成本、系统设计 | rag-022, rag-023, rag-024 |

### llm-transformer（24 卡，大模型面试·Transformer 卷）

| 专题 | 卡片 |
| --- | --- |
| 应用视角与考察点 | transformer-001, transformer-002 |
| RNN/CNN 局限与替代架构 | transformer-003, transformer-004, transformer-005 |
| Self-Attention / Q/K/V / √d_k / 公式 | transformer-006, transformer-007, transformer-008, transformer-009 |
| 对开发的启示 | transformer-010 |
| Multi-Head（机制、单头局限） | transformer-011, transformer-012 |
| 位置编码（必要性、绝对/相对、外推） | transformer-013, transformer-014, transformer-015 |
| 三大架构与选型 | transformer-016, transformer-017, transformer-018 |
| O(n²) / Lost in the Middle / 串行生成 | transformer-019, transformer-020, transformer-021 |
| KV Cache / MHA-MQA-GQA / 应用层优化 | transformer-022, transformer-023, transformer-024 |

### llm-finetuning（24 卡，大模型面试·微调卷）

| 专题 | 卡片 |
| --- | --- |
| 名词：SFT / RLHF / RL / PPO / DPO | finetune-001, finetune-002, finetune-003, finetune-004, finetune-005, finetune-006 |
| 微调 vs Prompt vs RAG | finetune-007, finetune-008 |
| 垂类微调为何被抹平 / 基模变强后的价值 | finetune-009, finetune-010 |
| SFT 破局点（控行为） | finetune-011 |
| RLHF / RL 破局点 | finetune-012, finetune-013, finetune-014 |
| SFT vs RLHF | finetune-015 |
| 不建议微调的场景 | finetune-016 |
| 收益评估与回归 | finetune-017 |
| mcq：PPO 定位 / RAG 优先 / DPO vs RLHF / 上线评测 | finetune-018, finetune-019, finetune-020, finetune-021 |
| cloze：名词全称 / SFT mask / DPO β 与 PPO KL | finetune-022, finetune-023, finetune-024 |

### llm-vibecoding（24 卡，大模型面试·AI 编程卷）

| 专题 | 卡片 |
| --- | --- |
| Vibe Coding 定义与边界 | vibe-001, vibe-002 |
| 工程师五大优势 | vibe-003, vibe-004, vibe-005, vibe-006, vibe-007, vibe-008 |
| Token 成本五策略 | vibe-009, vibe-010, vibe-011, vibe-012, vibe-013 |
| 工程纪律（Git/数据边界/模块拆分/回滚） | vibe-014, vibe-015, vibe-016, vibe-017 |
| Claude Code 原理（Loop / grep / 子 Agent / 压缩 / 权限） | vibe-018, vibe-019, vibe-020, vibe-021, vibe-022 |
| Spec-Driven Development | vibe-023 |
| 安全与合规 | vibe-024 |

> 五卷的来源、专题文章清单与「为什么按方向分卷」见 [docs/research/llm-interview-source-map.md](../docs/research/llm-interview-source-map.md)。

## 5. 出处清单

### 5.1 论文（arXiv，编号均经 arXiv API 核验标题）

| 编号 | 标题 | 用在 |
| --- | --- | --- |
| 1612.00796 | Overcoming catastrophic forgetting in neural networks | posttrain-027 |
| 1706.03741 | Deep reinforcement learning from human preferences | posttrain-001（RLHF 起源） |
| 1707.06347 | Proximal Policy Optimization Algorithms | posttrain-006 |
| 2005.11401 | Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks | basics-016, basics-017 |
| 2009.01325 | Learning to summarize from human feedback | posttrain-007 |
| 2106.09685 | LoRA: Low-Rank Adaptation of Large Language Models | posttrain-023, posttrain-025 |
| 2107.06499 | Deduplicating Training Data Makes Language Models Better | posttrain-021 |
| 2201.11903 | Chain-of-Thought Prompting Elicits Reasoning in Large Language Models | basics-006 |
| 2203.02155 | Training language models to follow instructions with human feedback | posttrain-001/002/004/005/007 |
| 2203.14465 | STaR: Bootstrapping Reasoning With Reasoning | posttrain-020 |
| 2209.13085 | Defining and Characterizing Reward Hacking | posttrain-018 |
| 2210.03629 | ReAct: Synergizing Reasoning and Acting in Language Models | basics-003/004/005 |
| 2210.10760 | Scaling Laws for Reward Model Overoptimization | posttrain-018 |
| 2302.12173 | Not what you've signed up for: Compromising Real-World LLM-Integrated Applications with Indirect Prompt Injection | interview-017, interview-018 |
| 2304.03442 | Generative Agents: Interactive Simulacra of Human Behavior | basics-013, basics-015 |
| 2305.04091 | Plan-and-Solve Prompting | basics-005 |
| 2305.10429 | DoReMi: Optimizing Data Mixtures Speeds Up Language Model Pretraining | posttrain-022 |
| 2305.10601 | Tree of Thoughts: Deliberate Problem Solving with Large Language Models | basics-007 |
| 2305.11206 | LIMA: Less Is More for Alignment | posttrain-003 |
| 2305.14314 | QLoRA: Efficient Finetuning of Quantized LLMs | posttrain-024 |
| 2305.16291 | Voyager: An Open-Ended Embodied Agent with Large Language Models | basics-013 |
| 2305.18290 | Direct Preference Optimization: Your Language Model is Secretly a Reward Model | posttrain-008/009/010 |
| 2305.20050 | Let's Verify Step by Step | posttrain-016/017/019 |
| 2306.05685 | Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena | basics-025 |
| 2306.08543 | MiniLLM: On-Policy Distillation of Large Language Models | posttrain-026 |
| 2307.03172 | Lost in the Middle: How Language Models Use Long Contexts | basics-017, interview-012 |
| 2308.03688 | AgentBench: Evaluating LLMs as Agents | basics-023 |
| 2310.06770 | SWE-bench: Can Language Models Resolve Real-World GitHub Issues? | interview-003 |
| 2310.08560 | MemGPT: Towards LLMs as Operating Systems | basics-013, basics-014 |
| 2310.12036 | A General Theoretical Paradigm to Understand Learning from Human Preferences（IPO） | posttrain-011 |
| 2402.01306 | KTO: Model Alignment as Prospect Theoretic Optimization | posttrain-011 |
| 2402.03300 | DeepSeekMath: Pushing the Limits of Mathematical Reasoning in Open Language Models（GRPO） | posttrain-012, posttrain-013 |
| 2403.07691 | ORPO: Monolithic Preference Optimization without Reference Model | posttrain-011 |
| 2405.09673 | LoRA Learns Less and Forgets Less | posttrain-027 |
| 2406.12045 | τ-bench: A Benchmark for Tool-Agent-User Interaction in Real-World Domains | basics-023/024, interview-022 |
| 2407.07890 | Training on the Test Task Confounds Evaluation and Emergence | posttrain-028 |
| 2411.15124 | Tülu 3: Pushing Frontiers in Open Language Model Post-Training | posttrain-010 |
| 2501.12948 | DeepSeek-R1: Incentivizing Reasoning Capability in LLMs via Reinforcement Learning | posttrain-014/019/020/026 |
| 2503.13657 | Why Do Multi-Agent LLM Systems Fail? | basics-020/028, interview-014/028 |
| 2503.14476 | DAPO: An Open-Source LLM Reinforcement Learning System at Scale | posttrain-015 |

### 5.2 官方文档 / 工程博客（HTTP 200 已核验）

| 出处 | 链接 | 用在 |
| --- | --- | --- |
| Anthropic《Building effective agents》 | https://www.anthropic.com/engineering/building-effective-agents | basics-001/002/012/018/019/021/022/027, interview-001/002/020/024/027 |
| Anthropic《How we built our multi-agent research system》 | https://www.anthropic.com/engineering/multi-agent-research-system | basics-019/026, interview-004/009/013/014/016/021/025/026/028 |
| Anthropic《Writing effective tools for agents》 | https://www.anthropic.com/engineering/writing-tools-for-agents | interview-023 |
| Anthropic《Effective context engineering for AI agents》 | https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents | basics-017, interview-011 |
| MCP 规范 2025-06-18 | https://modelcontextprotocol.io/specification/2025-06-18 | basics-010 |
| MCP Transports | https://modelcontextprotocol.io/specification/2025-06-18/basic/transports | basics-011 |
| OpenAI Function calling 指南 | https://platform.openai.com/docs/guides/function-calling | basics-008, basics-009 |
| OpenAI Agents SDK（handoffs） | https://openai.github.io/openai-agents-python/ | basics-018 |
| OpenTelemetry GenAI 语义约定 | https://opentelemetry.io/docs/specs/semconv/gen-ai/ | interview-015 |
| OWASP Top 10 for LLM Applications | https://owasp.org/www-project-top-10-for-large-language-model-applications/ | basics-021/022, interview-017/018/019 |
| Stripe Idempotent requests | https://docs.stripe.com/api/idempotent_requests | interview-007, interview-008 |
| AWS Builders Library：Making retries safe with idempotent APIs | https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/ | interview-005, interview-006 |
| Hugging Face TRL SFTTrainer | https://huggingface.co/docs/trl/sft_trainer | posttrain-002 |

## 6. 如何新增一个 deck

1. 在 `content/decks/` 新建 `<deck-id>.json`，`id` 与文件名一致，`cards` 24–30 张。
2. 选一个不与现有前缀冲突的 id 前缀（现有：`basics`、`interview`、`posttrain`、`agent`、`rag`、`transformer`、`finetune`、`vibe`），同 deck 内统一三位序号。
3. 每张卡按第 2 节 schema 填写；至少覆盖：qa 70%、mcq 20%、cloze 10%，难度 30/50/20。
4. 每张卡都写 `source`，优先 arXiv 编号或官方文档 URL；数字/公式必须能回溯到出处。
5. 在 `content/scripts/validate-decks.mjs` 的 `expectedPrefix` 里登记新 deck 的前缀。
6. 运行校验（第 7 节），必须 0 错误；警告为 0 更佳。
7. 新增 mcq 后运行 `node content/scripts/shuffle-mcq.mjs`，避免正确答案集中在同一位置（会保留 `.bak` 备份）。
8. 在本 README 第 4 节补「选题覆盖表」、第 5 节补「出处清单」。

## 7. 校验命令与输出

环境：Windows / PowerShell，Node 24。

### 7.1 JSON 可解析（JSON.parse）

```powershell
node -e 'const fs=require("fs");let t=0;for(const f of fs.readdirSync("content/decks").filter(x=>x.endsWith(".json"))){const p="content/decks/"+f;const d=JSON.parse(fs.readFileSync(p,"utf8"));t+=d.cards.length;console.log(p+" -> JSON OK, deck="+d.id+", cards="+d.cards.length)}console.log("total cards = "+t)'
```

输出：

```
content/decks/agent-basics.json -> JSON OK, deck=agent-basics, cards=28
content/decks/agent-interview.json -> JSON OK, deck=agent-interview, cards=28
content/decks/agent-post-training.json -> JSON OK, deck=agent-post-training, cards=28
content/decks/llm-agent.json -> JSON OK, deck=llm-agent, cards=24
content/decks/llm-rag.json -> JSON OK, deck=llm-rag, cards=24
content/decks/llm-transformer.json -> JSON OK, deck=llm-transformer, cards=24
content/decks/llm-finetuning.json -> JSON OK, deck=llm-finetuning, cards=24
content/decks/llm-vibecoding.json -> JSON OK, deck=llm-vibecoding, cards=24
total cards = 204
```

### 7.2 规范校验（卡数 / id 唯一 / mcq / cloze / 配比）

```powershell
node content/scripts/validate-decks.mjs
```

输出（退出码 0）：

```
== 每个 deck 概况 ==
agent-basics.json              卡数=28  qa=20 (71%) mcq=5 (18%)  cloze=3 (11%)  难度(1:8 2:14 3:6)  答案均长=159
agent-interview.json           卡数=28  qa=20 (71%) mcq=5 (18%)  cloze=3 (11%)  难度(1:8 2:14 3:6)  答案均长=187
agent-post-training.json       卡数=28  qa=20 (71%) mcq=5 (18%)  cloze=3 (11%)  难度(1:7 2:15 3:6)  答案均长=178
llm-agent.json                 卡数=24  qa=17 (71%) mcq=4 (17%)  cloze=3 (13%)  难度(1:7 2:12 3:5)  答案均长=255
llm-finetuning.json            卡数=24  qa=17 (71%) mcq=4 (17%)  cloze=3 (13%)  难度(1:7 2:12 3:5)  答案均长=187
llm-rag.json                   卡数=24  qa=17 (71%) mcq=4 (17%)  cloze=3 (13%)  难度(1:7 2:12 3:5)  答案均长=183
llm-transformer.json           卡数=24  qa=17 (71%) mcq=4 (17%)  cloze=3 (13%)  难度(1:7 2:12 3:5)  答案均长=217
llm-vibecoding.json            卡数=24  qa=17 (71%) mcq=4 (17%)  cloze=3 (13%)  难度(1:7 2:12 3:5)  答案均长=200

总卡数: 204，全局 id 唯一: 是

全部校验通过 ✔
```

### 7.3 MCQ 答案位置分布

```powershell
node content/scripts/shuffle-mcq.mjs --check   # 只报告，不写文件
node content/scripts/shuffle-mcq.mjs           # 写入，原文件保留 .bak
```

打散前全库 35 道 mcq 有 22 道答案在 B；打散后分布为 11 / 8 / 8 / 8（A/B/C/D），避免学习者靠位置蒙对、污染 FSRS 自评数据。

校验脚本会检查：

- JSON.parse 成功；`deck.id` 与文件名一致；`title/description/version/updatedAt` 合法
- 每个 deck 卡数 24–30；全局 id 唯一；id 形如 `prefix-001`；同 deck 前缀统一
- `type` 只能是 qa/mcq/cloze；`difficulty` 只能是 1/2/3
- mcq：恰好 4 个不重复 choices、`answerIndex` ∈ 0–3、`explanation` 非空、不带 `answer`
- cloze：question 含 `{{cN::…}}` 且 `{{c1::…}}` 闭合
- 题面可见长度 ≤60 字（cloze 的挖空内容算答案，不计入）
- `tags` 非空；`source` 非空且含 URL 或 arXiv 编号
- 卡型占比与难度占比偏离目标超过 12 个百分点时给出警告

## 8. 事实核验记录与待复核

**本轮已核验：**

- 39 个 arXiv 编号逐个经 `export.arxiv.org/api/query?id_list=…` 拉取标题，确认编号与标题对应（如 `2305.18290` = DPO、`2501.12948` = DeepSeek-R1、`2406.12045` = τ-bench）。
- 13 个官方文档 URL 全部返回 HTTP 200。
- 关键事实按页面原文核对：MCP 的 Host/Client/Server 与 Resources/Prompts/Tools 三特性、两种传输（stdio 与 Streamable HTTP，后者取代 2024-11-05 的 HTTP+SSE）；Anthropic 多 Agent 数据（90.2% 提升、约 4×/15× token）；OpenTelemetry GenAI 的 `gen_ai.request.model` 与 `gen_ai.usage.input_tokens/output_tokens`；OWASP 条目编号（LLM01 Prompt Injection、LLM08 Excessive Agency、LLM09 Overreliance）。

**已知待复核（建议二次确认，均不影响主线结论）：**

1. `posttrain-017` 中「PRM800K 约 80 万条步骤级标注」：数字来自原论文数据集规模，本轮未逐字复读论文正文。
2. `posttrain-025` 中「常见做法先固定 α 再扫 r」属工程经验，论文本身只给出 α/r 缩放形式，未规定调参流程。
3. `basics-005` 用 Plan-and-Solve（arXiv:2305.04091）作为「先规划后执行」类方法的代表出处；Plan-and-Execute 作为工程模式并无单一奠基论文，此处引用为最接近的学术来源。
