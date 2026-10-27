import { useMemo } from 'react'
import type { DeckCard } from '../lib/content'
import { countBlanks, parseCloze } from '../lib/cloze'
import { RichText, renderInline } from './RichText'

export interface CardViewProps {
  card: DeckCard
  flipped: boolean
  /** cloze blank ordinals already revealed */
  revealed: ReadonlySet<number>
  onRevealBlank: (ordinal: number) => void
  /** mcq selected option index (null = not answered) */
  choice: number | null
  onChoose: (index: number) => void
  /** reveal everything (also the Space shortcut) */
  onFlip: () => void
}

const TYPE_LABELS: Record<DeckCard['type'], string> = {
  qa: '问答',
  mcq: '选择题',
  cloze: '填空',
}

/**
 * The flashcard surface: question on the front, answer/explanation on the back.
 * Both faces stay mounted so the 3D flip is a pure CSS transition; the hidden
 * face is removed from the accessibility tree and from pointer events.
 */
export function CardView({ card, flipped, revealed, onRevealBlank, choice, onChoose, onFlip }: CardViewProps) {
  const clozeParts = useMemo(() => (card.type === 'cloze' ? parseCloze(card.text ?? '') : []), [card])
  const blanks = useMemo(() => countBlanks(clozeParts), [clozeParts])
  const allRevealed = card.type === 'cloze' && blanks > 0 && revealed.size >= blanks
  const correct = card.type === 'mcq' && choice !== null ? choice === card.answerIndex : null

  const frontHint =
    card.type === 'qa'
      ? '想好之后点击卡片或按空格查看答案'
      : card.type === 'cloze'
        ? '点击挖空处揭晓该空，或按空格查看完整答案'
        : '选择一个答案'

  return (
    <div className={`flashcard${flipped ? ' is-flipped' : ''}`}>
      <div className="flashcard__inner">
        <div
          className="flashcard__face flashcard__face--front"
          aria-hidden={flipped}
          onClick={card.type === 'mcq' ? undefined : onFlip}
          role={card.type === 'mcq' ? undefined : 'button'}
          tabIndex={card.type === 'mcq' || flipped ? -1 : 0}
          aria-label={card.type === 'mcq' ? undefined : '卡片正面：点击翻面'}
          onKeyDown={(event) => {
            if (card.type === 'mcq') return
            if (event.key === 'Enter') {
              event.preventDefault()
              onFlip()
            }
          }}
        >
          <div className="flashcard__meta">
            <span className={`badge badge--${card.type}`}>{TYPE_LABELS[card.type]}</span>
            {card.tags.length > 0 && <span className="flashcard__tags">{card.tags.slice(0, 3).join(' · ')}</span>}
          </div>

          {card.type === 'cloze' ? (
            <p className="flashcard__question flashcard__question--cloze">
              {clozeParts.map((part, index) =>
                part.type === 'text' ? (
                  <span key={`t${index}`}>{renderInline(part.text)}</span>
                ) : (
                  <button
                    key={`b${index}`}
                    type="button"
                    className={`cloze-blank${revealed.has(part.index) ? ' is-revealed' : ''}`}
                    aria-label={
                      revealed.has(part.index)
                        ? `已揭晓第 ${part.index} 空：${part.text}`
                        : `揭晓第 ${part.index} 空${part.hint ? `，提示：${part.hint}` : ''}`
                    }
                    tabIndex={flipped ? -1 : 0}
                    onClick={(event) => {
                      event.stopPropagation()
                      onRevealBlank(part.index)
                    }}
                  >
                    {revealed.has(part.index) ? part.text : part.hint ? `（${part.hint}）` : '____'}
                  </button>
                ),
              )}
            </p>
          ) : (
            <RichText className="flashcard__question" text={card.question} />
          )}

          {card.type === 'mcq' && (
            <ul className="mcq-options">
              {(card.options ?? []).map((option, index) => (
                <li key={`${option}-${index}`}>
                  <button
                    type="button"
                    className={`mcq-option${choice === index ? ' is-chosen' : ''}`}
                    tabIndex={flipped ? -1 : 0}
                    onClick={(event) => {
                      event.stopPropagation()
                      onChoose(index)
                    }}
                    aria-label={`选项 ${String.fromCharCode(65 + index)}：${option}`}
                  >
                    <span className="mcq-option__letter">{String.fromCharCode(65 + index)}</span>
                    <span className="mcq-option__text">{renderInline(option)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <p className="flashcard__hint">{allRevealed ? '按空格查看解析与评分' : frontHint}</p>
        </div>

        <div className="flashcard__face flashcard__face--back" aria-hidden={!flipped}>
          <div className="flashcard__meta">
            <span className={`badge badge--${card.type}`}>{TYPE_LABELS[card.type]}</span>
            {card.type === 'mcq' && correct !== null && (
              <span className={`badge ${correct ? 'badge--correct' : 'badge--wrong'}`}>
                {correct ? '答对了' : '答错了'}
              </span>
            )}
          </div>

          {card.type === 'qa' && <RichText className="flashcard__answer" text={card.answer ?? ''} />}

          {card.type === 'cloze' && (
            <>
              <p className="flashcard__answer flashcard__answer--cloze">
                {clozeParts.map((part, index) =>
                  part.type === 'text' ? (
                    <span key={`bt${index}`}>{renderInline(part.text)}</span>
                  ) : (
                    <mark key={`bb${index}`} className="cloze-revealed">
                      {part.text}
                    </mark>
                  ),
                )}
              </p>
              {card.answer && <RichText className="flashcard__answer flashcard__answer--notes" text={card.answer} />}
            </>
          )}

          {card.type === 'mcq' && (
            <>
              <p className="flashcard__answer">
                {choice !== null && (
                  <>
                    你选了 <strong>{String.fromCharCode(65 + choice)}</strong>，
                  </>
                )}
                正确答案是 <strong>{String.fromCharCode(65 + card.answerIndex)}</strong>：
                {renderInline(card.options?.[card.answerIndex] ?? '')}
              </p>
              <ul className="mcq-result">
                {(card.options ?? []).map((option, index) => {
                  const isAnswer = index === card.answerIndex
                  const isChoice = index === choice
                  return (
                    <li
                      key={`${option}-r${index}`}
                      className={`mcq-result__item${isAnswer ? ' is-answer' : ''}${isChoice && !isAnswer ? ' is-wrong' : ''}`}
                    >
                      <span className="mcq-result__letter">{String.fromCharCode(65 + index)}</span>
                      <span>{renderInline(option)}</span>
                      {isAnswer && <span className="mcq-result__mark">✓</span>}
                      {isChoice && !isAnswer && <span className="mcq-result__mark">✗</span>}
                    </li>
                  )
                })}
              </ul>
            </>
          )}

          {card.explanation && (
            <div className="flashcard__explanation">
              <h3>解析</h3>
              <RichText text={card.explanation} />
            </div>
          )}

          {card.source && <p className="flashcard__source">{card.source}</p>}

          {card.type === 'mcq' && (
            <p className="flashcard__hint">
              {correct ? '默认按「记得」记录，可用 1–4 或点击按钮修改' : '默认按「忘了」记录，可用 1–4 或点击按钮修改'}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
