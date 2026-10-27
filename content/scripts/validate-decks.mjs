#!/usr/bin/env node
// 校验 content/decks/*.json 是否符合 schema 与内容规范。
// 用法： node content/scripts/validate-decks.mjs
// 退出码：0 = 全部通过；1 = 有错误

import { readdirSync, readFileSync } from "node:fs";
import { join, basename, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const decksDir = join(here, "..", "decks");

const TYPE_TARGET = { qa: 0.7, mcq: 0.2, cloze: 0.1 };
const DIFF_TARGET = { 1: 0.3, 2: 0.5, 3: 0.2 };
const CARD_MIN = 24;
const CARD_MAX = 30;
const QUESTION_MAX_CHARS = 60;

const errors = [];
const warnings = [];
const seenIds = new Map();
const rows = [];

function err(file, cardId, msg) {
  errors.push(`[${file}]${cardId ? " " + cardId : ""} ${msg}`);
}
function warn(file, cardId, msg) {
  warnings.push(`[${file}]${cardId ? " " + cardId : ""} ${msg}`);
}
function len(s) {
  return [...String(s)].length;
}
function clozeBlanks(question) {
  const m = question.match(/\{\{c\d+::/g);
  return m ? m.length : 0;
}

let files = [];
try {
  files = readdirSync(decksDir).filter((f) => f.endsWith(".json")).sort();
} catch (e) {
  console.error(`无法读取目录 ${decksDir}: ${e.message}`);
  process.exit(1);
}
if (files.length === 0) {
  console.error(`目录 ${decksDir} 下没有 .json 文件`);
  process.exit(1);
}

for (const file of files) {
  const path = join(decksDir, file);
  let deck;
  try {
    deck = JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    err(file, null, `JSON 解析失败: ${e.message}`);
    continue;
  }

  const fileDeckId = basename(file, ".json");
  if (deck.id !== fileDeckId) {
    err(file, null, `deck.id "${deck.id}" 与文件名 "${fileDeckId}" 不一致`);
  }
  for (const key of ["id", "title", "description"]) {
    if (typeof deck[key] !== "string" || deck[key].trim() === "") {
      err(file, null, `缺少或为空的字段: ${key}`);
    }
  }
  if (!Number.isInteger(deck.version) || deck.version < 1) {
    err(file, null, "version 必须是 >=1 的整数");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(deck.updatedAt || "")) {
    err(file, null, "updatedAt 必须是 YYYY-MM-DD");
  }
  if (!Array.isArray(deck.cards)) {
    err(file, null, "cards 必须是数组");
    continue;
  }

  const n = deck.cards.length;
  if (n < CARD_MIN || n > CARD_MAX) {
    err(file, null, `卡数 ${n} 不在 ${CARD_MIN}–${CARD_MAX} 范围内`);
  }

  const typeCount = { qa: 0, mcq: 0, cloze: 0 };
  const diffCount = { 1: 0, 2: 0, 3: 0 };
  const answerLens = [];
  const prefixCount = new Map();

  for (const card of deck.cards) {
    const cid = card.id;
    if (typeof cid !== "string" || !/^[a-z][a-z0-9]*-\d{3}$/.test(cid)) {
      err(file, cid, "id 必须形如 prefix-001（小写字母 + 三位数字）");
      continue;
    }
    const prefix = cid.split("-")[0];
    prefixCount.set(prefix, (prefixCount.get(prefix) || 0) + 1);

    if (seenIds.has(cid)) {
      err(file, cid, `id 重复，已在 ${seenIds.get(cid)} 出现`);
    } else {
      seenIds.set(cid, file);
    }

    if (!["qa", "mcq", "cloze"].includes(card.type)) {
      err(file, cid, `type "${card.type}" 非法（只能是 qa / mcq / cloze）`);
      continue;
    }
    typeCount[card.type]++;

    if (![1, 2, 3].includes(card.difficulty)) {
      err(file, cid, `difficulty "${card.difficulty}" 非法（只能是 1/2/3）`);
    } else {
      diffCount[card.difficulty]++;
    }

    if (typeof card.question !== "string" || card.question.trim() === "") {
      err(file, cid, "question 不能为空");
    } else {
      // cloze 的挖空内容属于答案，不计入「可见题面」长度
      const visible = card.type === "cloze"
        ? card.question.replace(/\{\{c\d+::[\s\S]*?\}\}/g, "▢")
        : card.question;
      const qlen = len(visible);
      if (qlen > QUESTION_MAX_CHARS) {
        err(file, cid, `question 可见长度 ${qlen} 超过 ${QUESTION_MAX_CHARS} 字`);
      }
    }

    if (card.type === "mcq") {
      if (!Array.isArray(card.choices) || card.choices.length !== 4) {
        err(file, cid, "mcq 必须有 4 个 choices");
      } else {
        const uniq = new Set(card.choices);
        if (uniq.size !== 4) err(file, cid, "mcq 的 choices 有重复项");
        if (card.choices.some((c) => typeof c !== "string" || c.trim() === "")) {
          err(file, cid, "mcq 的 choices 不能有空项");
        }
      }
      if (!Number.isInteger(card.answerIndex) || card.answerIndex < 0 || card.answerIndex > 3) {
        err(file, cid, `answerIndex "${card.answerIndex}" 非法（必须是 0–3 的整数）`);
      }
      if (typeof card.explanation !== "string" || card.explanation.trim() === "") {
        err(file, cid, "mcq 必须写 explanation（解释为什么）");
      }
      if (card.answer !== undefined) {
        warn(file, cid, "mcq 不需要 answer 字段（内容放 explanation）");
      }
    } else if (card.type === "qa") {
      if (typeof card.answer !== "string" || card.answer.trim() === "") {
        err(file, cid, "qa 的 answer 不能为空");
      }
      if (card.choices !== undefined || card.answerIndex !== undefined) {
        err(file, cid, "qa 不应带 choices / answerIndex");
      }
    } else {
      // cloze
      if (typeof card.answer !== "string" || card.answer.trim() === "") {
        err(file, cid, "cloze 的 answer 不能为空");
      }
      const blanks = clozeBlanks(card.question || "");
      if (blanks === 0) {
        err(file, cid, "cloze 的 question 必须含 {{c1::...}} 挖空标记");
      }
      if ((card.question || "").includes("{{c1::") && !/\{\{c1::[^}]*\}\}/.test(card.question)) {
        err(file, cid, "cloze 的 {{c1::...}} 没有闭合");
      }
      if (card.choices !== undefined || card.answerIndex !== undefined) {
        err(file, cid, "cloze 不应带 choices / answerIndex");
      }
    }

    if (typeof card.answer === "string" && card.type !== "mcq") {
      answerLens.push(len(card.answer));
      const alen = len(card.answer);
      if (card.type === "qa" && (alen < 60 || alen > 450)) {
        warn(file, cid, `qa answer 长度 ${alen} 字，建议 80–400 字`);
      }
      if (card.type === "cloze" && (alen < 30 || alen > 300)) {
        warn(file, cid, `cloze answer 长度 ${alen} 字，建议 40–260 字`);
      }
    }

    if (!Array.isArray(card.tags) || card.tags.length === 0) {
      err(file, cid, "tags 必须是非空数组");
    }
    if (typeof card.source !== "string" || card.source.trim() === "") {
      err(file, cid, "source 不能为空");
    } else if (!/https?:\/\//.test(card.source) && !/arXiv:\d{4}\.\d{4,5}/.test(card.source)) {
      err(file, cid, "source 必须含 http(s) 链接或 arXiv 编号");
    }
  }

  // 前缀一致性
  const prefixes = [...prefixCount.keys()];
  if (prefixes.length !== 1) {
    err(file, null, `同一 deck 内 id 前缀不统一: ${prefixes.join(", ")}`);
  }
  const expectedPrefix = { "agent-basics": "basics", "agent-interview": "interview", "agent-post-training": "posttrain" }[fileDeckId];
  if (expectedPrefix && prefixes[0] !== expectedPrefix) {
    err(file, null, `前缀应为 "${expectedPrefix}"，实际为 "${prefixes[0]}"`);
  }

  const typePct = Object.fromEntries(Object.keys(typeCount).map((t) => [t, Math.round((typeCount[t] / n) * 100)]));
  const diffPct = Object.fromEntries(Object.keys(diffCount).map((d) => [d, Math.round((diffCount[d] / n) * 100)]));

  for (const [t, target] of Object.entries(TYPE_TARGET)) {
    const actual = typeCount[t] / n;
    if (Math.abs(actual - target) > 0.12) {
      warn(file, null, `题量占比 ${t}=${typePct[t]}%，偏离目标 ${Math.round(target * 100)}% 超过 12 个百分点`);
    }
  }
  for (const [d, target] of Object.entries(DIFF_TARGET)) {
    const actual = diffCount[d] / n;
    if (Math.abs(actual - target) > 0.12) {
      warn(file, null, `难度占比 ${d}=${diffPct[d]}%，偏离目标 ${Math.round(target * 100)}% 超过 12 个百分点`);
    }
  }

  rows.push({
    file,
    deck: deck.id,
    cards: n,
    qa: `${typeCount.qa} (${typePct.qa}%)`,
    mcq: `${typeCount.mcq} (${typePct.mcq}%)`,
    cloze: `${typeCount.cloze} (${typePct.cloze}%)`,
    diff: `1:${diffCount[1]} 2:${diffCount[2]} 3:${diffCount[3]}`,
    answerAvg: answerLens.length ? Math.round(answerLens.reduce((a, b) => a + b, 0) / answerLens.length) : 0,
  });
}

console.log("== 每个 deck 概况 ==");
for (const r of rows) {
  console.log(`${r.file.padEnd(30)} 卡数=${String(r.cards).padStart(2)}  qa=${r.qa.padEnd(9)} mcq=${r.mcq.padEnd(9)} cloze=${r.cloze.padEnd(9)} 难度(${r.diff})  答案均长=${r.answerAvg}`);
}
console.log(`\n总卡数: ${rows.reduce((a, r) => a + r.cards, 0)}，全局 id 唯一: ${seenIds.size === rows.reduce((a, r) => a + r.cards, 0) ? "是" : "否"}`);

if (warnings.length) {
  console.log(`\n== 警告 (${warnings.length}) ==`);
  for (const w of warnings) console.log("! " + w);
}
if (errors.length) {
  console.log(`\n== 错误 (${errors.length}) ==`);
  for (const e of errors) console.log("x " + e);
  process.exit(1);
}
console.log("\n全部校验通过 ✔");
