import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CardView } from './CardView'
import type { DeckCard } from '../lib/content'

function card(overrides: Partial<DeckCard> & Pick<DeckCard, 'type'>): DeckCard {
  return {
    uid: 'deck::1',
    id: '1',
    deckId: 'deck',
    question: '',
    tags: [],
    ...overrides,
  } as DeckCard
}

const qaCard = card({
  type: 'qa',
  question: '什么是 **Agent**？',
  answer: '- 自主决策\n- 调用工具',
  explanation: '不是所有调用 LLM 的系统都是 Agent。',
})

const clozeCard = card({
  type: 'cloze',
  text: '限制是 {{c1::MAX_STEPS}} 与 {{c2::token 预算}}。',
})

const mcqCard = card({
  type: 'mcq',
  question: 'ReAct 的顺序是？',
  options: ['Thought → Action → Observation', 'Action → Thought → Observation'],
  answerIndex: 0,
  explanation: '推理决定查什么，观察纠正推理。',
})

const noop = () => {}

describe('CardView — qa', () => {
  it('renders the question with inline Markdown and keeps the answer on the back', () => {
    const { container } = render(
      <CardView card={qaCard} flipped={false} revealed={new Set()} onRevealBlank={noop} choice={null} onChoose={noop} onFlip={noop} />,
    )
    expect(screen.getByText('Agent').tagName).toBe('STRONG')
    expect(container.querySelector('.flashcard__face--front')?.getAttribute('aria-hidden')).toBe('false')
    expect(container.querySelector('.flashcard__face--back')?.getAttribute('aria-hidden')).toBe('true')
    // answer is mounted (for the CSS flip) but hidden from assistive tech
    expect(screen.getByText('自主决策')).toBeInTheDocument()

    expect(container.querySelector('.flashcard')?.className).not.toContain('is-flipped')
    expect(screen.getByRole('button', { name: '卡片正面：点击翻面' })).toBeInTheDocument()
  })

  it('flips when the card face is clicked', async () => {
    const user = userEvent.setup()
    const onFlip = vi.fn()
    const { container } = render(
      <CardView card={qaCard} flipped={false} revealed={new Set()} onRevealBlank={noop} choice={null} onChoose={noop} onFlip={onFlip} />,
    )
    const front = container.querySelector('.flashcard__face--front')
    await user.click(front as HTMLElement)
    expect(onFlip).toHaveBeenCalledTimes(1)
  })

  it('exposes the back face and its explanation once flipped', () => {
    const { container } = render(
      <CardView card={qaCard} flipped revealed={new Set()} onRevealBlank={noop} choice={null} onChoose={noop} onFlip={noop} />,
    )
    expect(container.querySelector('.flashcard')?.className).toContain('is-flipped')
    expect(container.querySelector('.flashcard__face--back')?.getAttribute('aria-hidden')).toBe('false')
    expect(screen.getByText('解析')).toBeInTheDocument()
    expect(screen.getByText('不是所有调用 LLM 的系统都是 Agent。')).toBeInTheDocument()
  })
})

describe('CardView — cloze', () => {
  it('masks each blank as its own button', () => {
    render(
      <CardView card={clozeCard} flipped={false} revealed={new Set()} onRevealBlank={noop} choice={null} onChoose={noop} onFlip={noop} />,
    )
    const first = screen.getByRole('button', { name: /揭晓第 1 空/ })
    expect(first).toHaveTextContent('____')
    expect(screen.getByRole('button', { name: /揭晓第 2 空/ })).toBeInTheDocument()
  })

  it('reveals a blank without flipping the whole card', async () => {
    const user = userEvent.setup()
    const onRevealBlank = vi.fn()
    const onFlip = vi.fn()
    render(
      <CardView
        card={clozeCard}
        flipped={false}
        revealed={new Set()}
        onRevealBlank={onRevealBlank}
        choice={null}
        onChoose={noop}
        onFlip={onFlip}
      />,
    )
    await user.click(screen.getByRole('button', { name: /揭晓第 2 空/ }))
    expect(onRevealBlank).toHaveBeenCalledWith(2)
    expect(onFlip).not.toHaveBeenCalled() // stopPropagation keeps the card on the front
  })

  it('shows the answer text for revealed blanks', () => {
    render(
      <CardView
        card={clozeCard}
        flipped={false}
        revealed={new Set([1])}
        onRevealBlank={noop}
        choice={null}
        onChoose={noop}
        onFlip={noop}
      />,
    )
    expect(screen.getByRole('button', { name: /已揭晓第 1 空：MAX_STEPS/ })).toBeInTheDocument()
  })
})

describe('CardView — mcq', () => {
  it('lets the user pick an option', async () => {
    const user = userEvent.setup()
    const onChoose = vi.fn()
    render(
      <CardView card={mcqCard} flipped={false} revealed={new Set()} onRevealBlank={noop} choice={null} onChoose={onChoose} onFlip={noop} />,
    )
    await user.click(screen.getByRole('button', { name: /选项 B：Action/ }))
    expect(onChoose).toHaveBeenCalledWith(1)
  })

  it('reports a wrong answer and explains it', () => {
    const { container } = render(
      <CardView card={mcqCard} flipped revealed={new Set()} onRevealBlank={noop} choice={1} onChoose={noop} onFlip={noop} />,
    )
    expect(screen.getByText('答错了')).toBeInTheDocument()
    const back = container.querySelector('.flashcard__face--back')
    expect(back?.textContent).toContain('正确答案是')
    expect(back?.textContent).toContain('Thought → Action → Observation')
    expect(screen.getByText('推理决定查什么，观察纠正推理。')).toBeInTheDocument()
  })

  it('reports a correct answer', () => {
    render(
      <CardView card={mcqCard} flipped revealed={new Set()} onRevealBlank={noop} choice={0} onChoose={noop} onFlip={noop} />,
    )
    expect(screen.getByText('答对了')).toBeInTheDocument()
  })

  it('takes the front-face options out of the tab order and the accessibility tree once flipped', () => {
    const { container } = render(
      <CardView card={mcqCard} flipped revealed={new Set()} onRevealBlank={noop} choice={0} onChoose={noop} onFlip={noop} />,
    )
    const front = container.querySelector('.flashcard__face--front') as HTMLElement
    expect(front.getAttribute('aria-hidden')).toBe('true')
    const options = Array.from(front.querySelectorAll('button.mcq-option'))
    expect(options).toHaveLength(2)
    for (const option of options) {
      expect(option.getAttribute('tabindex')).toBe('-1')
    }
    // accessible queries agree: the back face is what assistive tech sees now
    expect(screen.queryByRole('button', { name: /选项 A/ })).toBeNull()
  })
})

describe('CardView — provenance', () => {
  it('shows the source line on the back when content provides one', () => {
    const withSource = { ...qaCard, source: 'Anthropic, Building effective agents' }
    render(
      <CardView card={withSource} flipped revealed={new Set()} onRevealBlank={noop} choice={null} onChoose={noop} onFlip={noop} />,
    )
    expect(screen.getByText('Anthropic, Building effective agents')).toBeInTheDocument()
  })
})
