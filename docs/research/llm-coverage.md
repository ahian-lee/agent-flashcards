# 五卷题库对正文的覆盖情况

> 生成时间：2026-10-27  
> 正文来源：`docs/research/llm-sources/`（10 篇专题全文，约 26 万字符）  
> 校验命令：`node content/scripts/validate-decks.mjs`（204 卡全部通过）

## 0. 结论先说

- 五卷每卷 **24 张卡**，是刻意设的上限：按「每卷 24 卡、qa 17 / mcq 4 / cloze 3」控制单次学习负担。
- **主专题的每一个 h2 章节都有卡片覆盖**；每章通常 1–4 张卡，核心章（如 MCP、RAG 幻觉、Transformer 架构、微调选型）覆盖更密。
- 24 卡不可能逐段复述正文：它做的是「把每章压缩成 1–2 个可背诵的考点」，细节（代码示例、长表格、案例数据）留在正文里，卡片 source 可直接跳回对应 §。
- 已知未单独成卡的内容列在文末「有意取舍」表。

## Agent 智能体卷（llm-agent）

- 正文主章节：**12** 节；卡片：**24** 张（qa 17 / mcq 4 / cloze 3）
- 正文文件：[`agent.txt`](llm-sources/agent.txt)；卡片 source 均带 § 与 URL

| 正文主章节 | 卡片 | 覆盖 |
| --- | --- | --- |
| 1. LLM 和 Agent 有什么区别？ | agent-001, agent-002 | 充分 |
| 2. Agent 和 Workflow 有什么区别？ | agent-003, agent-004 | 充分 |
| 3. Agent 有哪些工作模式？ | agent-005, agent-006, agent-007, agent-008, agent-009 | 充分 |
| 4. Function Call 是什么？底层怎么实现？ | agent-010, agent-011, agent-012 | 充分 |
| 5. MCP 是什么协议？解决什么问题？ | agent-013, agent-014, agent-015, agent-016 | 充分 |
| 6. Skills 是什么？和 Prompt 有什么区别？ | agent-017 | 单卡覆盖 |
| 7. Function Call、MCP、Skills 三者区别与协作？ | agent-018 | 单卡覆盖 |
| 8. A2A 协议是什么？和 MCP 的关系？ | agent-019 | 单卡覆盖 |
| 9. Agent 的记忆系统怎么设计？ | agent-020 | 单卡覆盖 |
| 10. Agent 的安全与可靠性如何保障？ | agent-021, agent-024 | 充分 |
| 11. RAG 和 Agent 是什么关系？ | agent-022 | 单卡覆盖 |
| 12. 大厂真实面试追问汇总 | — | 未单独成卡 |

## RAG 检索增强卷（llm-rag）

- 正文主章节：**12** 节；卡片：**24** 张（qa 17 / mcq 4 / cloze 3）
- 正文文件：[`rag.txt`](llm-sources/rag.txt)；卡片 source 均带 § 与 URL

| 正文主章节 | 卡片 | 覆盖 |
| --- | --- | --- |
| 1. RAG 是什么？为什么需要 RAG？ | rag-001, rag-002 | 充分 |
| 2. RAG 的完整链路是怎样的？ | rag-003, rag-004 | 充分 |
| 3. 向量检索的原理是什么？ | rag-005, rag-006, rag-007 | 充分 |
| 4. 向量数据库怎么选？Milvus、FAISS、Qdrant 各自适合什么场景？ | rag-008 | 单卡覆盖 |
| 5. 纯向量检索有什么问题？为什么需要混合检索？ | rag-009, rag-010 | 充分 |
| 6. Rerank 是什么？为什么检索之后还要重排序？ | rag-012, rag-013 | 充分 |
| 7. Chunk 怎么切？切大了切小了各有什么问题？ | rag-014, rag-015 | 充分 |
| 8. Embedding 模型怎么选？中文场景选什么？ | rag-016, rag-017 | 充分 |
| 9. RAG 的幻觉怎么处理？ | rag-018, rag-019 | 充分 |
| 10. RAG 检索效果不好怎么优化？ | rag-020, rag-021 | 充分 |
| 11. Agentic RAG 是什么？和普通 RAG 有什么区别？ | rag-022 | 单卡覆盖 |
| 12. 大厂真实面试追问汇总 | rag-011, rag-023, rag-024 | 充分 |

## Transformer 原理卷（llm-transformer）

- 正文主章节：**8** 节；卡片：**24** 张（qa 17 / mcq 4 / cloze 3）
- 正文文件：[`transformer.txt`](llm-sources/transformer.txt)；卡片 source 均带 § 与 URL

| 正文主章节 | 卡片 | 覆盖 |
| --- | --- | --- |
| 1. 为什么应用开发也要懂 Transformer？ | transformer-001, transformer-002 | 充分 |
| 2. 为什么所有大模型都绕不开 Transformer？ | transformer-003, transformer-004, transformer-005 | 充分 |
| 3. Self-Attention：Transformer 的灵魂 | transformer-006, transformer-007, transformer-008 | 充分 |
| 4. Multi-Head Attention：为什么要多个头？ | transformer-009, transformer-010 | 充分 |
| 5. Positional Encoding：为什么位置信息这么重要？ | transformer-011, transformer-012, transformer-013 | 充分 |
| 6. Encoder vs Decoder vs Decoder-Only：三大架构怎么选？ | transformer-014, transformer-015, transformer-016, transformer-017 | 充分 |
| 7. Transformer 的局限性 | transformer-018, transformer-019, transformer-020, transformer-021, transformer-022 | 充分 |
| 8. 面试高频问题汇总 | transformer-023, transformer-024 | 充分 |

## 模型微调卷（llm-finetuning）

- 正文主章节：**11** 节；卡片：**24** 张（qa 17 / mcq 4 / cloze 3）
- 正文文件：[`finetune.txt`](llm-sources/finetune.txt)；卡片 source 均带 § 与 URL

| 正文主章节 | 卡片 | 覆盖 |
| --- | --- | --- |
| 一、先说结论：微调没有消失，只是价值变了 | finetune-001 | 单卡覆盖 |
| 二、先把名词讲清楚：SFT、RLHF、RL、PPO、DPO 是什么 | finetune-002, finetune-003, finetune-004, finetune-005, finetune-006, finetune-007, finetune-008 | 充分 |
| 三、微调、Prompt、RAG 到底怎么选 | finetune-009, finetune-010, finetune-011 | 充分 |
| 四、为什么很多垂类微调会被基模抹平 | finetune-012, finetune-013, finetune-014 | 充分 |
| 五、SFT 的破局点：从补知识变成控行为 | finetune-015, finetune-016 | 充分 |
| 六、RLHF / RL 的破局点：从变聪明变成控偏好和控决策 | finetune-017, finetune-018, finetune-019 | 充分 |
| 七、DPO 为什么现在经常被提到 | finetune-020, finetune-021 | 充分 |
| 八、什么场景不建议做微调 | finetune-022 | 单卡覆盖 |
| 九、工程上怎么判断微调有没有收益 | finetune-023 | 单卡覆盖 |
| 十、面试官可能怎么追问 | finetune-024 | 单卡覆盖 |
| 十一、面试怎么答 | — | 未单独成卡 |

## AI 编程卷（llm-vibecoding）

- 正文主章节：**4** 节；卡片：**24** 张（qa 17 / mcq 4 / cloze 3）
- 正文文件：[`vibe.txt`](llm-sources/vibe.txt)；卡片 source 均带 § 与 URL

| 正文主章节 | 卡片 | 覆盖 |
| --- | --- | --- |
| 1. Vibe Coding 到底是什么？ | vibe-001, vibe-002 | 充分 |
| 2. AI 越来越强，你的优势到底是什么？ | vibe-003, vibe-004, vibe-005, vibe-006 | 充分 |
| 3. AI 编程工具的 Token 成本怎么控制？ | vibe-007, vibe-008, vibe-009, vibe-010, vibe-011 | 充分 |
| 4. 面试高频问题汇总 | vibe-024 | 单卡覆盖 |

**主篇之外的补充专题卡**（Claude Code / 避坑 / SDD，共 13 张）

| 专题 | 卡片 |
| --- | --- |
| Claude Code 深度解析（§二/三/四/五/六/七） | vibe-016, vibe-017, vibe-018, vibe-019, vibe-020, vibe-021 |
| Claude Code 为什么不用 RAG 检索代码（§三/§七） | vibe-022 |
| Vibe Coding 避坑指南（§一/二/四/五） | vibe-012, vibe-013, vibe-014, vibe-015 |
| Spec-Driven Development（§一/§二） | vibe-023 |
| Claude Code 上下文窗口（§八 Auto-Compact） | vibe-019（与深度解析合并引用） |

**补充专题卡（主篇之外）**

| 专题 | 卡片 |
| --- | --- |
| Vibe Coding 避坑指南 | vibe-012 |
| Spec-Driven Development 规约驱动开发 | vibe-023 |
| Vibe Coding 避坑指南 | vibe-013 |
| Claude Code 大厂面试题汇总 | vibe-016 |
| Vibe Coding 避坑指南 | vibe-014 |
| Claude Code 大厂面试题汇总 | vibe-020 |
| Vibe Coding 避坑指南 | vibe-015 |
| Claude Code 大厂面试题汇总 | vibe-018 |
| Claude Code 大厂面试题汇总 | vibe-017 |
| Claude Code 为什么不用 RAG 检索代码 | vibe-022 |
| Claude Code 大厂面试题汇总 | vibe-019 |
| Claude Code 大厂面试题汇总 | vibe-021 |

## 有意取舍 / 未单独成卡

| 卷 | 内容 | 处理 |
| --- | --- | --- |
| Agent | §12 大厂真实追问的逐条清单 | 并入 023（系统设计）与 024（生产坑），不逐条成卡 |
| RAG | §12 的延迟/索引更新/Token 成本细节 | 并入 023（上线后延迟、索引、成本）与 024（十万用户设计） |
| Transformer | §8 的逐题速答 | 分散到各章卡片的 explanation，不重复成卡 |
| 微调 | §十 的 8 条追问 | 以 §十.x 副标注并入对应主卡，避免重复 |
| AI 编程 | AI 增强开发三件套 / OpenSpec / gstack / GraphRAG 等延伸专题 | 未纳入（属五卷之外的进阶内容，V2 可扩卷） |
| AI 编程 | Claude Code 源码泄露事件细节（59.8MB、v2.1.88） | 未单独成卡，避免把版本号当考点；需要时看正文 |

## 复核方式

```powershell
node content/scripts/validate-decks.mjs          # 204 卡 schema/配比
node content/scripts/shuffle-mcq.mjs --check     # mcq 答案位置分布
```

每张卡的 `source` 形如：

```
卡码笔记《RAG 大厂面试题汇总》§6 Rerank 重排序 https://notes.kamacoder.com/interview/llm/rag_interview.html
```

打开 `docs/research/llm-sources/` 下的正文即可逐条对照。
