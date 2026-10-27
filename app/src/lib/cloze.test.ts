import { describe, expect, it } from 'vitest'
import { countBlanks, parseCloze, revealAll } from './cloze'

describe('parseCloze', () => {
  it('splits text and blanks, keeping order', () => {
    const parts = parseCloze('ReAct: {{c1::Thought}} → {{c2::Action}} → Observation')
    expect(parts).toHaveLength(5)
    expect(parts[0]).toEqual({ type: 'text', text: 'ReAct: ' })
    expect(parts[1]).toMatchObject({ type: 'blank', text: 'Thought', index: 1 })
    expect(parts[3]).toMatchObject({ type: 'blank', text: 'Action', index: 2 })
  })

  it('reads the optional hint', () => {
    const parts = parseCloze('限制是 {{c1::MAX_STEPS::英文名}}')
    const blank = parts.find((part) => part.type === 'blank')
    expect(blank).toMatchObject({ text: 'MAX_STEPS', hint: '英文名' })
  })

  it('returns a single text part when there is no blank', () => {
    expect(parseCloze('没有挖空')).toEqual([{ type: 'text', text: '没有挖空' }])
  })

  it('handles blanks at the very start and end', () => {
    const parts = parseCloze('{{c1::A}} middle {{c2::B}}')
    expect(parts[0]).toMatchObject({ type: 'blank', text: 'A' })
    expect(parts.at(-1)).toMatchObject({ type: 'blank', text: 'B' })
  })

  it('counts blanks and can reveal them all', () => {
    const parts = parseCloze('{{c1::a}}{{c2::b}}{{c3::c}}')
    expect(countBlanks(parts)).toBe(3)
    expect(revealAll('{{c1::a}}{{c2::b}}{{c3::c}}')).toBe('abc')
  })
})
