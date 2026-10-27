/**
 * Content layer: turns whatever `../content/decks/*.json` (or the committed
 * fallback decks) contain into one canonical, strictly typed shape.
 *
 * Normalisation lives in TypeScript rather than in `scripts/sync-content.mjs`
 * on purpose: a single implementation that unit tests can exercise, and the
 * sync script stays a dumb copier that never breaks a build.
 */

export type CardType = 'qa' | 'mcq' | 'cloze'

interface DeckCardBase {
  /** Globally unique progress key: `${deckId}::${id}`. */
  uid: string
  /** Stable per-deck card id. */
  id: string
  deckId: string
  question: string
  explanation?: string
  hint?: string
  /** provenance line (`source` in the deck files), shown on the card back */
  source?: string
  tags: string[]
}

export interface QaCard extends DeckCardBase {
  type: 'qa'
  answer: string
}

export interface McqCard extends DeckCardBase {
  type: 'mcq'
  options: string[]
  answerIndex: number
}

export interface ClozeCard extends DeckCardBase {
  type: 'cloze'
  /** sentence with `{{c1::…}}` blanks */
  text: string
  /** full sentence / key points shown after the reveal */
  answer?: string
}

/** Discriminated union: `card.type` narrows the renderer safely. */
export type DeckCard = QaCard | McqCard | ClozeCard

export interface Deck {
  id: string
  title: string
  description?: string
  cards: DeckCard[]
  /** true when the deck shown is the committed placeholder content */
  placeholder: boolean
}

export interface RawDeckSource {
  raw: unknown
  /** file-name based hint, used when the JSON has no id */
  idHint?: string
}

export type ContentSource = 'content' | 'mixed' | 'fallback'

export interface BuiltContent {
  decks: Deck[]
  source: ContentSource
}

interface CanonicalSlot {
  id: string
  title: string
  description: string
  pattern: RegExp
}

/** The three decks the product promises, in display order. */
export const CANONICAL_SLOTS: readonly CanonicalSlot[] = [
  {
    id: 'agent-basics',
    title: 'Agent 基础知识',
    description: '把 Agent 的基本概念过一遍：循环、工具、记忆、规划。',
    pattern: /基础|fundament|basic|intro/i,
  },
  {
    id: 'agent-interview',
    title: 'Agent 面试题库',
    description: '面试高频问题与追问，带参考答案要点。',
    pattern: /面试|interview|八股/i,
  },
  {
    id: 'agent-post-training',
    title: 'Agent 后训练知识',
    description: 'SFT、RLHF / DPO、对齐与评测等后训练要点。',
    pattern: /后训练|post[-_ ]?train|rlhf|对齐|align|dpo|sft/i,
  },
]

const CLOZE_PATTERN = /\{\{c(\d+)::(.*?)(?:::(.*?))?\}\}/s
const BLANK_PLACEHOLDER = /_{3,}|\[\[?blank\]?\]|\[\s*\]/

function text(value: unknown): string {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return `${value}`
  return ''
}

function firstString(raw: Record<string, unknown>, keys: readonly string[]): string {
  for (const key of keys) {
    const value = text(raw[key])
    if (value) return value
  }
  return ''
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>
  return null
}

/** `my-deck` style slug used as a last-resort deck / card id. */
export function slugify(value: string, fallback: string): string {
  const slug = value
    .toLowerCase()
    .replace(/\.[^.]+$/, '')
    .replace(/[^\w\u4e00-\u9fa5-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || fallback
}

function normalizeOptions(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map((option) => {
      if (typeof option === 'string' || typeof option === 'number') return text(option)
      const record = asRecord(option)
      if (!record) return ''
      return firstString(record, ['text', 'label', 'value', 'option', 'content', 'answer'])
    })
    .filter((option) => option.length > 0)
}

function normalizeAnswerIndex(raw: Record<string, unknown>, options: string[]): number {
  const numeric = [raw.answerIndex, raw.correctIndex, raw.correct_index, raw.correct, raw.answer_index]
  for (const candidate of numeric) {
    if (typeof candidate === 'number' && Number.isInteger(candidate)) {
      return clampIndex(candidate, options.length)
    }
  }
  const labeled = [raw.answerIndex, raw.correctIndex, raw.answer, raw.correctAnswer, raw.answerText]
  for (const candidate of labeled) {
    const value = text(candidate)
    if (!value) continue
    const byText = options.findIndex((option) => option === value)
    if (byText >= 0) return byText
    if (/^[A-Za-z]$/.test(value)) {
      const byLetter = value.toUpperCase().charCodeAt(0) - 65
      if (byLetter >= 0 && byLetter < options.length) return byLetter
    }
    if (/^\d+$/.test(value)) return clampIndex(Number(value), options.length)
  }
  return 0
}

function clampIndex(value: number, length: number): number {
  if (length === 0) return 0
  if (value < 0 || value >= length) return 0
  return value
}

/** Detect the card type from explicit metadata, else from its shape. */
function detectType(raw: Record<string, unknown>, clozeText: string): CardType {
  const declared = text(raw.type ?? raw.kind ?? raw.format).toLowerCase()
  if (declared === 'mcq' || declared === 'choice' || declared === 'multiple_choice' || declared === 'single') {
    return 'mcq'
  }
  if (declared === 'cloze' || declared === 'fill' || declared === 'blank' || declared === 'fill_blank') {
    return 'cloze'
  }
  if (declared === 'qa' || declared === 'basic' || declared === 'question' || declared === 'open' || declared === 'flashcard') {
    return 'qa'
  }
  if (Array.isArray(raw.options) && raw.options.length > 0) return 'mcq'
  if (Array.isArray(raw.choices) && raw.choices.length > 0) return 'mcq'
  if (CLOZE_PATTERN.test(clozeText)) return 'cloze'
  return 'qa'
}

function normalizeCard(raw: unknown, deckId: string, index: number): DeckCard | null {
  const record = asRecord(raw)
  if (!record) return null

  const id = firstString(record, ['id', 'cardId', 'card_id', 'slug', 'key']) || `c${index + 1}`
  const question = firstString(record, ['question', 'q', 'front', 'prompt', 'title', 'term', 'text'])
  const answer = firstString(record, ['answer', 'a', 'back', 'definition', 'meaning', 'response', 'explanation'])
  const explanation = firstString(record, ['explanation', 'rationale', 'note', 'notes', 'why', 'comment', 'detail'])
  const hint = firstString(record, ['hint', 'clue', 'tip'])
  const source = firstString(record, ['source', 'ref', 'reference', 'citation', 'url'])
  const rawText = firstString(record, ['text', 'cloze', 'sentence'])
  const tags = Array.isArray(record.tags) ? record.tags.map(text).filter(Boolean) : []

  const type = detectType(record, rawText || question)

  if (type === 'mcq') {
    const options = normalizeOptions(record.options ?? record.choices ?? record.choices_list)
    if (options.length < 2) return null
    return {
      uid: `${deckId}::${id}`,
      id,
      deckId,
      type: 'mcq',
      question: question || options.join(' / '),
      options,
      answerIndex: normalizeAnswerIndex(record, options),
      explanation,
      hint,
      source,
      tags,
    }
  }

  if (type === 'cloze') {
    let cloze = rawText || question
    // tolerate `__` + answer pairs: turn the first placeholder into a real blank
    if (!CLOZE_PATTERN.test(cloze) && answer) {
      if (BLANK_PLACEHOLDER.test(cloze)) cloze = cloze.replace(BLANK_PLACEHOLDER, `{{c1::${answer}}}`)
      else cloze = `${cloze} ${`{{c1::${answer}}}`}`
    }
    if (!CLOZE_PATTERN.test(cloze)) return null
    return {
      uid: `${deckId}::${id}`,
      id,
      deckId,
      type: 'cloze',
      question: question && question !== cloze ? question : '',
      text: cloze,
      // for cloze cards `answer` holds the full sentence / key points, shown after reveal
      answer: answer && answer !== cloze && !cloze.includes(answer) ? answer : undefined,
      explanation,
      hint,
      source,
      tags,
    }
  }

  if (!question) return null
  return {
    uid: `${deckId}::${id}`,
    id,
    deckId,
    type: 'qa',
    question,
    answer: answer || '（内容缺失）',
    explanation,
    hint,
    source,
    tags,
  }
}

/** Re-label a card when its deck id / card id had to change (collisions). */
function relabel(card: DeckCard, deckId: string, id: string): DeckCard {
  return { ...card, deckId, id, uid: `${deckId}::${id}` }
}

/** Normalise one deck file; returns `null` when nothing usable is inside. */
export function normalizeDeck(source: RawDeckSource, fallbackId: string): Deck | null {
  const raw = source.raw
  const record = asRecord(raw)
  const cardsRaw = Array.isArray(raw)
    ? raw
    : record
      ? (Array.isArray(record.cards)
        ? record.cards
        : Array.isArray(record.items)
          ? record.items
          : Array.isArray(record.questions)
            ? record.questions
            : [])
      : []

  const deckId = slugify(
    firstString(record ?? {}, ['id', 'deckId', 'slug', 'key']) || source.idHint || fallbackId,
    fallbackId,
  )
  const title = firstString(record ?? {}, ['title', 'name', 'label', 'deck', 'topic']) || deckId
  const description = firstString(record ?? {}, ['description', 'desc', 'subtitle', 'summary', 'intro'])

  const seen = new Set<string>()
  const cards: DeckCard[] = []
  for (const [index, cardRaw] of cardsRaw.entries()) {
    const card = normalizeCard(cardRaw, deckId, index)
    if (!card) continue
    let id = card.id
    let suffix = 2
    while (seen.has(id)) {
      id = `${card.id}-${suffix}`
      suffix += 1
    }
    seen.add(id)
    cards.push(id === card.id ? card : relabel(card, deckId, id))
  }

  if (cards.length === 0) return null
  return { id: deckId, title, description: description || undefined, cards, placeholder: false }
}

function matchesSlot(deck: Deck, slot: CanonicalSlot): boolean {
  if (deck.id === slot.id) return true
  return slot.pattern.test(deck.id) || slot.pattern.test(deck.title)
}

function renameDeck(deck: Deck, id: string): Deck {
  return {
    ...deck,
    id,
    cards: deck.cards.map((card) => relabel(card, id, card.id)),
  }
}

/**
 * Merge real content with the committed fallback decks.
 *
 * Real content always wins. A fallback deck is only used to fill a canonical
 * slot that real content did not cover, so the app never shows fewer than the
 * three promised decks while `content/` is still being written.
 */
export function buildDecks(real: readonly RawDeckSource[], fallback: readonly RawDeckSource[]): BuiltContent {
  const fallbackDecks = fallback
    .map((source, index) => normalizeDeck(source, CANONICAL_SLOTS[index]?.id ?? `fallback-${index + 1}`))
    .filter((deck): deck is Deck => deck !== null)
  const realDecks = real
    .map((source, index) => normalizeDeck(source, source.idHint ?? `deck-${index + 1}`))
    .filter((deck): deck is Deck => deck !== null)

  if (realDecks.length === 0) {
    return {
      decks: fallbackDecks.map((deck) => ({ ...deck, placeholder: true })),
      source: 'fallback',
    }
  }

  const usedReal = new Set<Deck>()
  const decks: Deck[] = []
  let usedFallback = false

  for (const slot of CANONICAL_SLOTS) {
    const match = realDecks.find((deck) => !usedReal.has(deck) && matchesSlot(deck, slot))
    if (match) {
      usedReal.add(match)
      decks.push(renameDeck(match, match.id))
      continue
    }
    const placeholder = fallbackDecks.find((deck) => deck.id === slot.id)
    if (placeholder) {
      usedFallback = true
      decks.push({ ...renameDeck(placeholder, slot.id), placeholder: true })
    }
  }

  for (const deck of realDecks) {
    if (usedReal.has(deck)) continue
    usedReal.add(deck)
    decks.push(deck)
  }

  // de-duplicate deck ids (e.g. content reuses a canonical id twice)
  const seen = new Set<string>()
  const unique = decks.map((deck) => {
    let id = deck.id
    let suffix = 2
    while (seen.has(id)) {
      id = `${deck.id}-${suffix}`
      suffix += 1
    }
    seen.add(id)
    return id === deck.id ? deck : renameDeck(deck, id)
  })

  return { decks: unique, source: usedFallback ? 'mixed' : 'content' }
}

/** Flat, order-stable list of every card across decks. */
export function allCards(decks: readonly Deck[]): DeckCard[] {
  return decks.flatMap((deck) => deck.cards)
}

export function findDeck(decks: readonly Deck[], deckId: string | undefined): Deck | undefined {
  if (!deckId) return undefined
  return decks.find((deck) => deck.id === deckId)
}
