#!/usr/bin/env node
/**
 * End-to-end smoke test against the *built* app, at iPhone-ish 375x812 @2x.
 *
 * Prerequisites (the script is intentionally not a hard dependency of the app):
 *   npm run build
 *   npm run preview                 # http://127.0.0.1:4173/
 *   npm i -D playwright-core        # one-off; uses your system Chrome, no browser download
 *
 * Run:
 *   node scripts/smoke-preview.mjs
 *   SMOKE_URL=http://127.0.0.1:4173/ SMOKE_BROWSER=msedge node scripts/smoke-preview.mjs
 *
 * Screenshots land in `.smoke/` (gitignored).
 */
import { chromium } from 'playwright-core'
import { mkdirSync, writeFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const appRoot = resolve(here, '..')
const BASE = process.env.SMOKE_URL || 'http://127.0.0.1:4173/'
const BROWSER = process.env.SMOKE_BROWSER || 'chrome'
const SHOTS = join(appRoot, '.smoke')
mkdirSync(SHOTS, { recursive: true })

const checks = []
const errors = []
function check(name, ok, detail = '') {
  checks.push({ name, ok: Boolean(ok), detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`)
}

const browser = await chromium.launch({ channel: BROWSER, headless: true })
const context = await browser.newContext({
  viewport: { width: 375, height: 812 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  locale: 'zh-CN',
  acceptDownloads: true,
})
const page = await context.newPage()
page.on('console', (message) => message.type() === 'error' && errors.push(message.text()))
page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))

const shot = (name) => page.screenshot({ path: join(SHOTS, `${name}.png`) })
const badge = async () => (await page.locator('.flashcard__meta .badge').first().innerText()).trim()
const counter = async () => (await page.locator('.study-head__counter').innerText()).trim()
const settle = () => page.waitForTimeout(650)
const blur = () => page.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.blur())
const dbCount = (store) =>
  page.evaluate(
    (name) =>
      new Promise((resolveCount) => {
        const request = indexedDB.open('agent-flashcards')
        request.onsuccess = () => {
          const countRequest = request.result.transaction(name, 'readonly').objectStore(name).count()
          countRequest.onsuccess = () => resolveCount(countRequest.result)
        }
      }),
    store,
  )

async function rate(label) {
  const before = await counter()
  await page.locator('.rating-bar button', { hasText: label }).click()
  await page.waitForFunction(
    (previous) => document.querySelector('.study-head__counter')?.textContent?.trim() !== previous,
    before,
    { timeout: 8000 },
  )
  await page.waitForTimeout(120)
  return `${before} -> ${await counter()}`
}

async function rateEasyUntilDone(limit = 24) {
  const summaryPanel = () => page.locator('.summary[aria-label="本次学习小结"]')
  let guard = 0
  while ((await summaryPanel().count()) === 0 && guard < limit) {
    guard += 1
    await page.waitForSelector('.flashcard', { timeout: 10000 })
    const kind = await badge()
    if (kind === '选择题') {
      await page.locator('.mcq-option').first().click()
      await page.waitForSelector('.flashcard.is-flipped')
    } else {
      await blur()
      await page.keyboard.press(' ')
      await page.waitForSelector('.flashcard.is-flipped')
    }
    await rate('太简单')
  }
  return guard
}

try {
  // ------------------------------------------------------------------ home
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.waitForSelector('.deck', { timeout: 15000 })
  check('首页加载并渲染', true, page.url())
  check('标题正确', (await page.title()).includes('Agent 闪卡'))
  const deckCount = await page.locator('.deck').count()
  const deckTitles = (await page.locator('.deck__title').allInnerTexts()).join(' | ')
  check('8 个 deck 可见', deckCount === 8, `count=${deckCount}`)
  check(
    'deck 标题符合预期',
    ['Agent 基础知识', 'Agent 面试题库', 'Agent 后训练知识', 'Agent 智能体卷', 'RAG 检索增强卷', 'Transformer 原理卷', '模型微调卷', 'AI 编程卷'].every((t) => deckTitles.includes(t)),
    deckTitles,
  )

  const overflow = await page.evaluate(() => ({
    html: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
    inner: window.innerWidth,
  }))
  check('375px 无横向滚动', overflow.html <= overflow.inner && overflow.body <= overflow.inner, JSON.stringify(overflow))
  const cta = await page.locator('.btn--primary').first().boundingBox()
  check('主按钮触摸目标 ≥44px', cta && cta.height >= 44, `h=${cta?.height}`)
  const tabHeight = await page.evaluate(() => document.querySelector('.tabbar__item')?.getBoundingClientRect().height ?? 0)
  check('底部 tab 触摸目标 ≥44px', tabHeight >= 44, `h=${tabHeight}`)
  check('底部 3 个 tab', (await page.locator('.tabbar__item').count()) === 3)
  await shot('01-home')

  // ----------------------------------------------------------------- study
  await page.locator('.btn--primary', { hasText: '开始学习' }).click()
  await page.waitForSelector('.flashcard', { timeout: 10000 })
  const counter0 = await counter()
  check('进入学习页并显示进度计数', /^\d+ \/ \d+$/.test(counter0), counter0)
  check('卡片默认未翻面', (await page.locator('.flashcard.is-flipped').count()) === 0)
  check('评分按钮未翻面时隐藏', (await page.locator('.rating-bar').count()) === 0)
  await shot('02-study-front')

  await page.locator('.flashcard__face--front').click()
  await page.waitForSelector('.flashcard.is-flipped')
  await page.waitForSelector('.rating-bar button')
  await settle()
  await shot('03-study-back')
  check('翻面后出现四档评分', (await page.locator('.rating-bar button').count()) === 4)
  const labels = (await page.locator('.rating__label').allInnerTexts()).join('/')
  check('评分文案为 Again/Hard/Good/Easy 中文', labels === '忘了/困难/记得/太简单', labels)
  const intervals = await page.locator('.rating__interval').allInnerTexts()
  check('每个评分显示下次间隔', intervals.every((text) => text.length > 0), intervals.join(' | '))
  const faceState = await page.evaluate(() => {
    const front = document.querySelector('.flashcard__face--front')
    const back = document.querySelector('.flashcard__face--back')
    return {
      frontAriaHidden: front?.getAttribute('aria-hidden'),
      backAriaHidden: back?.getAttribute('aria-hidden'),
      frontPointerEvents: front ? getComputedStyle(front).pointerEvents : null,
    }
  })
  check('隐藏面对无障碍/指针均不可用', faceState.frontAriaHidden === 'true' && faceState.backAriaHidden === 'false' && faceState.frontPointerEvents === 'none', JSON.stringify(faceState))

  const moved = await rate('记得')
  check('评分后进度前进', moved.split(' -> ')[0] !== moved.split(' -> ')[1], moved)

  await blur()
  await page.keyboard.press(' ')
  await page.waitForSelector('.flashcard.is-flipped')
  check('空格键翻面', true)
  await blur()
  await page.keyboard.press('3')
  await page.waitForTimeout(300)
  check('数字键 3 评分', (await counter()) !== moved.split(' -> ')[1], await counter())

  // ------------------------------------------------- cloze + mcq rendering
  let sawCloze = false
  let sawMcq = false
  for (let index = 0; index < 12 && (!sawCloze || !sawMcq); index += 1) {
    await page.waitForSelector('.flashcard')
    const kind = await badge()
    if (kind === '填空' && !sawCloze) {
      sawCloze = true
      const blanks = page.locator('.cloze-blank')
      check('填空题有挖空', (await blanks.count()) >= 1)
      check('挖空默认隐藏', (await blanks.first().innerText()).trim() === '____')
      await blanks.first().click()
      await page.waitForTimeout(150)
      check('点击挖空处揭晓答案', (await page.locator('.cloze-blank.is-revealed').first().innerText()).trim() !== '____')
      await shot('04-cloze')
      await blur()
      await page.keyboard.press(' ')
      await page.waitForSelector('.flashcard.is-flipped')
      await rate('困难')
      continue
    }
    if (kind === '选择题' && !sawMcq) {
      sawMcq = true
      check('选择题有 4 个选项', (await page.locator('.mcq-option').count()) === 4)
      await page.locator('.mcq-option').nth(1).click()
      await page.waitForSelector('.flashcard.is-flipped')
      await settle()
      await shot('05-mcq')
      const back = await page.locator('.flashcard__face--back').innerText()
      check('选择题显示对错判定', back.includes('答对了') || back.includes('答错了'))
      check('选择题显示解析', back.includes('解析'))
      await rate('记得')
      continue
    }
    await blur()
    await page.keyboard.press(' ')
    await page.waitForSelector('.flashcard.is-flipped')
    await rate('记得')
  }
  check('遍历到填空题', sawCloze)
  check('遍历到选择题', sawMcq)

  // ----------------------------------------------------- persistence (IDB)
  const beforeReload = await dbCount('cardStates')
  check('评分写入 IndexedDB', beforeReload >= 2, `cardStates=${beforeReload}`)
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForSelector('.flashcard, .summary, .empty-state', { timeout: 15000 })
  check('刷新后进度仍在', (await dbCount('cardStates')) === beforeReload, `${beforeReload} -> ${await dbCount('cardStates')}`)

  // ------------------------------------------------------------------ stats
  await page.goto(`${BASE}#/stats`, { waitUntil: 'networkidle' })
  await page.waitForSelector('.chart')
  await shot('06-stats')
  const tiles = await page.locator('.tile__value').allInnerTexts()
  const labelsTiles = await page.locator('.tile__label').allInnerTexts()
  check('统计页四项总计', tiles.length === 4 && labelsTiles.includes('总卡片'), `${labelsTiles.join('/')} = ${tiles.join('/')}`)
  check('今日已复习 > 0', Number(tiles[labelsTiles.indexOf('今日已复习')]) > 0)
  check('近 7 天柱状图 7 根柱', (await page.locator('.chart__bar').count()) === 7)

  // --------------------------------------------------------- export/import
  await page.goto(`${BASE}#/settings`, { waitUntil: 'networkidle' })
  await page.waitForSelector('#new-per-day')
  check('默认每日新卡 20', (await page.locator('#new-per-day').inputValue()) === '20')
  check('默认每日复习 200', (await page.locator('#review-per-day').inputValue()) === '200')
  check('设置页 375px 无横向滚动', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))

  const downloadPromise = page.waitForEvent('download', { timeout: 10000 })
  await page.locator('.btn', { hasText: '导出' }).click()
  const download = await downloadPromise
  const filename = download.suggestedFilename()
  check('导出 JSON 触发下载', /^agent-flashcards-\d{4}-\d{2}-\d{2}\.json$/.test(filename), filename)
  const savedPath = join(SHOTS, filename)
  await download.saveAs(savedPath)
  const exported = JSON.parse(await readFile(savedPath, 'utf8'))
  check('导出含版本与进度', exported.version === 1 && exported.cardStates.length > 0, `v${exported.version} states=${exported.cardStates.length} logs=${exported.reviewLogs.length}`)
  writeFileSync(join(SHOTS, 'export-summary.json'), JSON.stringify({ version: exported.version, states: exported.cardStates.length, logs: exported.reviewLogs.length }, null, 2))

  await page.locator('input[type="file"]').setInputFiles(savedPath)
  await page.waitForSelector('.toast--success', { hasText: '导入成功', timeout: 15000 })
  const importToast = await page.locator('.toast--success', { hasText: '导入成功' }).first().innerText()
  check('导入刚导出的备份成功', /导入成功/.test(importToast), importToast)

  // ------------------------------------------------------------- dark mode
  await page.locator('.segmented__item', { hasText: '深色' }).click()
  await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark')
  await settle()
  await shot('07-settings-dark')
  check('深色主题生效', (await page.evaluate(() => getComputedStyle(document.body).backgroundColor)) === 'rgb(11, 18, 32)')

  // ------------------------------------------------------------- summary
  // Fresh state so the daily caps start clean and the session can finish:
  // reset (two-step confirm) -> small new-card cap -> study one deck to the end.
  await page.goto(`${BASE}#/settings`, { waitUntil: 'networkidle' })
  await page.locator('.btn', { hasText: '重置' }).first().click()
  await page.waitForSelector('.btn', { hasText: '确认重置' })
  check('重置需要二次确认', (await page.locator('.notice--warn').count()) > 0)
  await page.locator('.btn', { hasText: '确认重置' }).click()
  await page.waitForSelector('.toast--success', { hasText: '重置', timeout: 15000 })
  check('重置清空本地进度', (await dbCount('cardStates')) === 0)
  await page.waitForTimeout(300)
  await page.locator('#new-per-day').fill('3')
  await page.locator('#new-per-day').press('Enter')
  await page.waitForTimeout(400)
  check('可直接输入每日新卡上限', (await page.locator('#new-per-day').inputValue()) === '3')
  await page.goto(`${BASE}#/study/agent-interview`, { waitUntil: 'networkidle' })
  await page.waitForSelector('.flashcard, .empty-state, .summary', { timeout: 15000 })
  const passes = await rateEasyUntilDone()
  const summaryPanel = page.locator('.summary[aria-label="本次学习小结"]')
  const summary = (await summaryPanel.count()) > 0
  check('学习结束显示会话小结', summary, `passes=${passes}`)
  if (summary) {
    await shot('08-summary')
    const text = await summaryPanel.innerText()
    check('小结含正确率与下次到期', text.includes('正确率') && text.includes('下次到期'))
  } else {
    const emptyState = (await page.locator('.empty-state').count()) > 0
    check('队列已空时给出空态而不是缺卡提示', emptyState)
  }

  // ------------------------------------------------------------------- PWA
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.waitForSelector('.deck')
  const manifestHref = await page.evaluate(() => document.querySelector('link[rel="manifest"]')?.getAttribute('href') ?? '')
  check('注入 manifest', manifestHref.includes('manifest.webmanifest'), manifestHref)
  const manifest = await page.evaluate(async (href) => (await fetch(href)).json(), manifestHref)
  check('manifest name/short_name', manifest.name === 'Agent 闪卡' && manifest.short_name === 'Agent闪卡', `${manifest.name} / ${manifest.short_name}`)
  check('manifest display=standalone', manifest.display === 'standalone')
  check('manifest 含 192/512 图标', manifest.icons.some((icon) => icon.sizes === '192x192') && manifest.icons.some((icon) => icon.sizes === '512x512'))
  check('theme-color 已设置', /^#/.test(await page.evaluate(() => document.querySelector('meta[name="theme-color"]')?.getAttribute('content') ?? '')))

  const swState = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return 'unsupported'
    const registration = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise((resolveReady) => setTimeout(() => resolveReady(null), 15000)),
    ])
    return registration ? (registration.active?.state ?? 'no-active') : 'timeout'
  })
  check('Service Worker 已激活', swState === 'activated', swState)
  await shot('09-home-dark')

  await context.setOffline(true)
  await page.reload({ waitUntil: 'domcontentloaded' })
  let offlineOk = false
  try {
    await page.waitForSelector('.deck', { timeout: 15000 })
    offlineOk = (await page.locator('.deck').count()) === 8
  } catch {
    offlineOk = false
  }
  check('断网刷新仍可用（SW 预缓存）', offlineOk)
  if (offlineOk) await shot('10-offline')
  await context.setOffline(false)
} catch (error) {
  errors.push(`exception: ${error.message}`)
  console.error('EXCEPTION', error)
  try {
    await shot('99-failure')
  } catch {
    /* ignore */
  }
} finally {
  const realErrors = errors.filter((text) => !/favicon|React DevTools/i.test(text))
  check('无控制台错误', realErrors.length === 0, realErrors.slice(0, 3).join(' | '))
  await browser.close()
}

const failed = checks.filter((entry) => !entry.ok)
console.log('\n=== SUMMARY ===')
console.log(
  JSON.stringify(
    { url: BASE, viewport: '375x812 @2x', passed: checks.length - failed.length, failed: failed.length, failures: failed, shots: SHOTS },
    null,
    2,
  ),
)
process.exit(failed.length === 0 ? 0 : 1)
