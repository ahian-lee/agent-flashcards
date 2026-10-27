import { describe, expect, it } from 'vitest'
import { buildDecks, normalizeDeck } from './content'
import { decks, contentSource } from '../content'

const qaRaw = {
  id: 'agent-basics',
  title: 'Agent 基础知识',
  cards: [
    { id: 'a1', type: 'qa', question: '什么是 Agent？', answer: '能自主决策并调用工具的系统。', tags: ['基础'] },
    { id: 'a2', type: 'mcq', question: 'ReAct 的顺序？', choices: ['T-A-O', 'A-T-O'], answerIndex: 0, explanation: '推理→行动→观察' },
    { id: 'a3', type: 'cloze', question: '限制是 {{c1::MAX_STEPS}}', answer: '最大步数上限' },
  ],
}

const fallbackDeck = (id: string, title: string) => ({
  id,
  title,
  cards: [{ id: `${id}-1`, type: 'qa', question: 'q', answer: 'a' }],
})

describe('normalizeDeck', () => {
  it('normalises qa / mcq / cloze cards from the real content schema', () => {
    const deck = normalizeDeck({ raw: qaRaw, idHint: 'agent-basics' }, 'agent-basics')
    expect(deck).not.toBeNull()
    if (!deck) return
    expect(deck.id).toBe('agent-basics')
    expect(deck.cards).toHaveLength(3)
    expect(deck.cards[0]).toMatchObject({ type: 'qa', uid: 'agent-basics::a1', answer: '能自主决策并调用工具的系统。' })
    expect(deck.cards[1]).toMatchObject({ type: 'mcq', answerIndex: 0, options: ['T-A-O', 'A-T-O'] })
    expect(deck.cards[2]).toMatchObject({ type: 'cloze', text: '限制是 {{c1::MAX_STEPS}}' })
    // the cloze `answer` is a note shown on the back, not a duplicate of the sentence
    const clozeCard = deck.cards[2]
    if (clozeCard.type !== 'cloze') throw new Error('expected a cloze card')
    expect(clozeCard.answer).toBe('最大步数上限')
  })

  it('accepts `options` as an alias of `choices`', () => {
    const deck = normalizeDeck(
      {
        raw: {
          id: 'x',
          cards: [{ id: 'm', type: 'mcq', question: 'q', options: ['a', 'b', 'c'], answer: 'B' }],
        },
      },
      'x',
    )
    expect(deck?.cards[0]).toMatchObject({ type: 'mcq', answerIndex: 1 })
  })

  it('infers the type when `type` is missing', () => {
    const deck = normalizeDeck(
      {
        raw: {
          id: 'x',
          cards: [{ id: 'm', question: 'q', choices: ['a', 'b'] }, { id: 'c', question: 'fill {{c1::it}} in' }],
        },
      },
      'x',
    )
    expect(deck?.cards.map((card) => card.type)).toEqual(['mcq', 'cloze'])
  })

  it('dedupes repeated card ids inside one deck', () => {
    const deck = normalizeDeck(
      {
        raw: {
          id: 'x',
          cards: [
            { id: 'same', type: 'qa', question: 'q1', answer: 'a1' },
            { id: 'same', type: 'qa', question: 'q2', answer: 'a2' },
          ],
        },
      },
      'x',
    )
    expect(deck?.cards.map((card) => card.id)).toEqual(['same', 'same-2'])
  })

  it('drops cards that cannot be rendered', () => {
    const deck = normalizeDeck(
      { raw: { id: 'x', cards: [{ id: 'empty' }, { id: 'ok', type: 'qa', question: 'q', answer: 'a' }] } },
      'x',
    )
    expect(deck?.cards).toHaveLength(1)
  })

  it('returns null for decks without usable cards', () => {
    expect(normalizeDeck({ raw: { id: 'x', cards: [] } }, 'x')).toBeNull()
    expect(normalizeDeck({ raw: 'nope' }, 'x')).toBeNull()
  })

  it('reads cards from a bare array file', () => {
    const deck = normalizeDeck({ raw: [{ id: 'a', question: 'q', answer: 'a' }], idHint: 'bare-deck' }, 'fallback')
    expect(deck?.id).toBe('bare-deck')
    expect(deck?.cards).toHaveLength(1)
  })
})

describe('buildDecks', () => {
  const fallbacks = [
    { raw: fallbackDeck('agent-basics', 'Agent 基础知识'), idHint: 'agent-basics' },
    { raw: fallbackDeck('agent-interview', 'Agent 面试题库'), idHint: 'agent-interview' },
    { raw: fallbackDeck('agent-post-training', 'Agent 后训练知识'), idHint: 'agent-post-training' },
  ]

  it('uses fallback content only when there is no real content', () => {
    const built = buildDecks([], fallbacks)
    expect(built.source).toBe('fallback')
    expect(built.decks).toHaveLength(3)
    expect(built.decks.every((deck) => deck.placeholder)).toBe(true)
  })

  it('prefers real content and keeps canonical order', () => {
    const built = buildDecks(
      [
        { raw: { id: 'post', title: 'Agent 后训练知识', cards: [{ id: 'p', type: 'qa', question: 'q', answer: 'a' }] }, idHint: 'post' },
        { raw: qaRaw, idHint: 'agent-basics' },
        { raw: { id: 'iv', title: 'Agent 面试题库', cards: [{ id: 'i', type: 'qa', question: 'q', answer: 'a' }] }, idHint: 'iv' },
      ],
      fallbacks,
    )
    expect(built.source).toBe('content')
    expect(built.decks.map((deck) => deck.title)).toEqual(['Agent 基础知识', 'Agent 面试题库', 'Agent 后训练知识'])
    expect(built.decks.every((deck) => deck.placeholder === false)).toBe(true)
  })

  it('fills only the missing canonical slot with fallback content', () => {
    const built = buildDecks([{ raw: qaRaw, idHint: 'agent-basics' }], fallbacks)
    expect(built.source).toBe('mixed')
    expect(built.decks).toHaveLength(3)
    expect(built.decks.filter((deck) => deck.placeholder)).toHaveLength(2)
  })

  it('keeps extra real decks after the canonical three', () => {
    const built = buildDecks(
      [
        { raw: qaRaw, idHint: 'agent-basics' },
        { raw: { id: 'extra', title: '额外 deck', cards: [{ id: 'e', type: 'qa', question: 'q', answer: 'a' }] } },
      ],
      fallbacks,
    )
    expect(built.decks).toHaveLength(4)
    expect(built.decks.at(-1)?.id).toBe('extra')
  })
})

describe('shipped content (src/content)', () => {
  it('always exposes at least the three canonical decks with cards', () => {
    expect(decks.length).toBeGreaterThanOrEqual(3)
    for (const deck of decks) {
      expect(deck.cards.length).toBeGreaterThan(0)
    }
  })

  it('has globally unique card uids, and each uid is namespaced by its deck', () => {
    const uids = decks.flatMap((deck) => deck.cards.map((card) => card.uid))
    expect(new Set(uids).size).toBe(uids.length)
    for (const deck of decks) {
      for (const card of deck.cards) {
        expect(card.uid).toBe(`${deck.id}::${card.id}`)
      }
    }
  })

  it('reports where the content came from', () => {
    expect(['content', 'mixed', 'fallback']).toContain(contentSource)
  })
})
