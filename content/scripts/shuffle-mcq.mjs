#!/usr/bin/env node
/**
 * 打散 MCQ 正确答案位置（确定性、可复现）。
 *
 * 背景：题库里 35 道 mcq 有 22 道答案在 B，学习者会靠位置蒙对，污染 FSRS 的
 * 自评数据。本脚本只交换 choices 的位置并同步 answerIndex，不改题干/解析/答案文本。
 *
 * 策略：按 deck 轮转目标位置（0,1,2,3 循环），保证每个 deck 内答案分布尽量均匀；
 * 用固定种子对选项做一次洗牌，避免「正确项总是被换到同一个位置」。
 *
 * 用法：node content/scripts/shuffle-mcq.mjs [--check]
 *   --check 只报告分布，不写文件。
 */
import { readdirSync, readFileSync, writeFileSync, copyFileSync, renameSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const decksDir = join(here, '..', 'decks')
const CHECK = process.argv.includes('--check')

/** xorshift32：固定种子，保证每次运行结果一致 */
function makeRng(seed) {
  let state = seed >>> 0
  return () => {
    state ^= state << 13; state >>>= 0
    state ^= state >>> 17
    state ^= state << 5; state >>>= 0
    return state / 0x100000000
  }
}

function shuffleInPlace(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

const files = readdirSync(decksDir).filter((f) => f.endsWith('.json')).sort()
let total = 0
const before = { 0: 0, 1: 0, 2: 0, 3: 0 }
const after = { 0: 0, 1: 0, 2: 0, 3: 0 }

for (const file of files) {
  const path = join(decksDir, file)
  const deck = JSON.parse(readFileSync(path, 'utf8'))
  const mcqs = deck.cards.filter((c) => c.type === 'mcq')
  if (mcqs.length === 0) continue

  const rng = makeRng(0x5eed ^ [...file].reduce((a, ch) => a + ch.charCodeAt(0), 0))
  let changed = 0

  mcqs.forEach((card, index) => {
    if (!Array.isArray(card.choices) || card.choices.length !== 4) return
    if (!Number.isInteger(card.answerIndex) || card.answerIndex < 0 || card.answerIndex > 3) return

    total++
    before[card.answerIndex]++

    // 目标位置：按 deck 内顺序轮转，保证 0/1/2/3 均匀
    const target = index % 4
    const correct = card.choices[card.answerIndex]
    const rest = card.choices.filter((_, i) => i !== card.answerIndex)
    shuffleInPlace(rest, rng)

    // 把正确项插到目标位置，其余顺序填满
    const next = []
    let r = 0
    for (let i = 0; i < 4; i++) {
      if (i === target) next.push(correct)
      else next.push(rest[r++])
    }

    if (target !== card.answerIndex) changed++
    card.choices = next
    card.answerIndex = target
    after[target]++
  })

  if (changed > 0 && !CHECK) {
    const tmp = path + '.tmp'
    writeFileSync(tmp, JSON.stringify(deck, null, 2) + '\n', 'utf8')
    copyFileSync(path, path + '.bak')
    renameSync(tmp, path)
  }

  console.log(`${file.padEnd(28)} mcq=${mcqs.length} 调整=${changed}`)
}

console.log('\n调整前分布:', JSON.stringify(before), '总计', total)
console.log('调整后分布:', JSON.stringify(after), '总计', total)
if (CHECK) console.log('（--check：未写文件）')
else console.log('已写入；每个被改文件保留 .bak 备份。')
