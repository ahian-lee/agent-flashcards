import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Grade } from 'ts-fsrs'
import { allCards, findDeck } from '../lib/content'
import { decks } from '../content'
import { CardView } from '../components/CardView'
import { ErrorNotice } from '../components/ErrorNotice'
import { RatingBar } from '../components/RatingBar'
import { useToast } from '../components/Toast'
import { describeDbError, loadSettings, loadStateMap, loadTodayCounts, recordReview } from '../lib/db'
import { formatDue } from '../lib/dates'
import { buildQueue, shouldRequeue } from '../lib/queue'
import type { QueueItem, QueueResult, QueueSettings } from '../lib/queue'
import { DEFAULT_SETTINGS } from '../lib/settings'
import type { Settings } from '../lib/settings'
import { Rating, isNewState, previewSchedule, schedule } from '../lib/scheduler'
import type { CardStateRecord } from '../lib/scheduler'
import { notifyDbChanged } from '../lib/store'
import { hrefFor } from '../lib/router'

interface StudySession {
  items: QueueItem[]
  cursor: number
  /** cards this session intends to cover; fixed so re-queued learning cards don't shrink the bar */
  goal: number
  reviewed: number
  correct: number
  newLearned: number
}

const KEY_RATINGS: Record<string, Grade> = {
  '1': Rating.Again,
  '2': Rating.Hard,
  '3': Rating.Good,
  '4': Rating.Easy,
}

const UNLIMITED: QueueSettings = { newPerDay: 9999, reviewPerDay: 9999, learnAheadMinutes: 20 }

export function StudyPage({ deckId }: { deckId?: string }) {
  const toast = useToast()
  const deck = findDeck(decks, deckId)
  const scopeCards = useMemo(() => (deck ? deck.cards : allCards(decks)), [deck])
  const cardMap = useMemo(() => new Map(scopeCards.map((card) => [card.uid, card])), [scopeCards])

  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [session, setSession] = useState<StudySession | null>(null)
  const [queueInfo, setQueueInfo] = useState<QueueResult | null>(null)
  const [bootError, setBootError] = useState<string | null>(null)
  const [activeState, setActiveState] = useState<CardStateRecord | null>(null)
  const [flipped, setFlipped] = useState(false)
  const [revealed, setRevealed] = useState<ReadonlySet<number>>(() => new Set<number>())
  const [choice, setChoice] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)

  const bootedRef = useRef(false)
  const cacheRef = useRef<Record<string, CardStateRecord>>({})
  const countsRef = useRef({ newDone: 0, reviewDone: 0 })

  // ---------------------------------------------------------------- boot
  useEffect(() => {
    if (bootedRef.current) return
    bootedRef.current = true
    void (async () => {
      try {
        const [states, counts, loadedSettings] = await Promise.all([
          loadStateMap(),
          loadTodayCounts(),
          loadSettings(),
        ])
        cacheRef.current = states
        countsRef.current = counts
        setSettings(loadedSettings)
        const built = buildQueue({
          cards: scopeCards,
          states,
          newDoneToday: counts.newDone,
          reviewDoneToday: counts.reviewDone,
          settings: loadedSettings,
          now: Date.now(),
          deckId,
        })
        setQueueInfo(built)
        setSession({ items: built.items, cursor: 0, goal: built.items.length, reviewed: 0, correct: 0, newLearned: 0 })
      } catch (error) {
        setBootError(describeDbError(error))
      }
    })()
  }, [deckId, scopeCards])

  const current = session && session.cursor < session.items.length ? session.items[session.cursor] : undefined
  const card = current ? cardMap.get(current.uid) : undefined

  // reset per-card UI whenever the active card changes
  useEffect(() => {
    if (!current) {
      setActiveState(null)
      return
    }
    setActiveState(cacheRef.current[current.uid] ?? null)
    setFlipped(false)
    setRevealed(new Set<number>())
    setChoice(null)
  }, [current?.uid]) // eslint-disable-line react-hooks/exhaustive-deps

  const previews = useMemo(() => previewSchedule(activeState, Date.now()), [activeState])

  const mcqCorrect = card && card.type === 'mcq' && choice !== null ? choice === card.answerIndex : null
  const suggested: Grade | null = mcqCorrect === null ? null : mcqCorrect ? Rating.Good : Rating.Again

  const rate = useCallback(
    async (rating: Grade) => {
      if (!current || !card || busy) return
      setBusy(true)
      const now = Date.now()
      const prev = cacheRef.current[current.uid] ?? null
      const actualCorrect =
        card.type === 'mcq' && choice !== null ? choice === card.answerIndex : rating !== Rating.Again
      try {
        const result = schedule(prev, rating, now, {
          cardId: current.uid,
          deckId: current.deckId,
          cardType: card.type,
          correct: actualCorrect,
        })
        await recordReview(result.card, result.log)
        cacheRef.current[current.uid] = result.card
        const wasNew = isNewState(prev?.state)
        countsRef.current = {
          newDone: countsRef.current.newDone + (wasNew ? 1 : 0),
          reviewDone: countsRef.current.reviewDone + (wasNew ? 0 : 1),
        }
        const requeue = shouldRequeue(result.card, now, settings.learnAheadMinutes)
        setSession((previous) => {
          if (!previous) return previous
          return {
            items: requeue
              ? [...previous.items, { uid: current.uid, deckId: current.deckId, kind: 'learn-ahead' }]
              : previous.items,
            cursor: previous.cursor + 1,
            goal: previous.goal,
            reviewed: previous.reviewed + 1,
            correct: previous.correct + (actualCorrect ? 1 : 0),
            newLearned: previous.newLearned + (wasNew ? 1 : 0),
          }
        })
        notifyDbChanged()
      } catch (error) {
        toast.error(describeDbError(error))
      } finally {
        setBusy(false)
      }
    },
    [busy, card, choice, current, settings.learnAheadMinutes, toast],
  )

  const handleFlip = useCallback(() => {
    if (!card || card.type === 'mcq') return
    setFlipped(true)
  }, [card])

  const handleChoose = useCallback(
    (index: number) => {
      if (!card || flipped || busy) return
      setChoice(index)
      setFlipped(true)
    },
    [busy, card, flipped],
  )

  const handleRevealBlank = useCallback((ordinal: number) => {
    setRevealed((previous) => {
      const next = new Set(previous)
      next.add(ordinal)
      return next
    })
  }, [])

  const startNewSession = useCallback(
    (bypassCaps = false) => {
      const effective: QueueSettings = bypassCaps
        ? { ...settings, newPerDay: UNLIMITED.newPerDay, reviewPerDay: UNLIMITED.reviewPerDay }
        : { ...settings }
      const built = buildQueue({
        cards: scopeCards,
        states: cacheRef.current,
        newDoneToday: bypassCaps ? 0 : countsRef.current.newDone,
        reviewDoneToday: bypassCaps ? 0 : countsRef.current.reviewDone,
        settings: effective,
        now: Date.now(),
        deckId,
      })
      setQueueInfo(built)
      setSession({ items: built.items, cursor: 0, goal: built.items.length, reviewed: 0, correct: 0, newLearned: 0 })
    },
    [deckId, scopeCards, settings],
  )

  // ------------------------------------------------------------ keyboard
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      const target = event.target as HTMLElement | null
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
      // a focused native button already reacts to Space/Enter: don't double-handle it
      if (target?.closest('button')) return

      if (event.key === ' ' || event.code === 'Space') {
        if (!session || !card) return
        event.preventDefault()
        if (!flipped) {
          if (card.type !== 'mcq') handleFlip()
        } else if (!busy) {
          void rate(suggested ?? Rating.Good)
        }
        return
      }

      const rating = KEY_RATINGS[event.key]
      if (rating && flipped && !busy) {
        event.preventDefault()
        void rate(rating)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [busy, card, flipped, handleFlip, rate, session, suggested])

  const nextDue = useMemo(() => {
    const now = Date.now()
    let earliest: number | null = null
    for (const item of scopeCards) {
      const state = cacheRef.current[item.uid]
      if (!state) continue
      if (state.due > now && (earliest === null || state.due < earliest)) earliest = state.due
    }
    return earliest
    // recompute after every finished review
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeCards, session?.reviewed])

  const heading = deck ? deck.title : '混合复习'
  const total = session?.items.length ?? 0
  const cursor = session?.cursor ?? 0
  const goal = session?.goal ?? 0
  const reviewed = session?.reviewed ?? 0
  // re-queued learning cards extend the work left, but never move the bar backwards
  const progress = goal === 0 ? 0 : Math.min(1, reviewed / goal)
  const remaining = Math.max(0, total - cursor)
  const reinforcement = Math.max(0, total - goal)
  const finished = session !== null && total > 0 && cursor >= total
  const empty = session !== null && total === 0

  return (
    <div className="page page--study">
      <header className="study-head">
        <a className="icon-btn" href={hrefFor('/')} aria-label="返回首页">
          ←
        </a>
        <div className="study-head__title">
          <h1>{heading}</h1>
          <p className="muted small">
            {finished ? '本次已完成' : `剩余 ${remaining} 张`}
            {!finished && reinforcement > 0 && `（含 ${reinforcement} 张待巩固）`}
            {deck?.placeholder && <span className="badge badge--ghost">示例</span>}
          </p>
        </div>
        <span className="study-head__counter" aria-live="polite" aria-label={`进度 ${reviewed} / ${goal}`}>
          {reviewed} / {goal}
        </span>
      </header>

      <div className="bar bar--thin" role="progressbar" aria-valuemin={0} aria-valuemax={goal} aria-valuenow={reviewed}>
        <span className="bar__fill" style={{ width: `${progress * 100}%` }} />
      </div>

      {bootError && <ErrorNotice message={bootError} />}

      {!session && !bootError && <p className="empty">正在读取本地进度…</p>}

      {session && finished && (
        <section className="summary" aria-label="本次学习小结">          <h2 className="summary__title">这一轮完成了 🎉</h2>
          <dl className="summary__grid">
            <div>
              <dt>学习卡片</dt>
              <dd>{session.reviewed}</dd>
            </div>
            <div>
              <dt>新学</dt>
              <dd>{session.newLearned}</dd>
            </div>
            <div>
              <dt>正确率</dt>
              <dd>{session.reviewed === 0 ? '—' : `${Math.round((session.correct / session.reviewed) * 100)}%`}</dd>
            </div>
            <div>
              <dt>下次到期</dt>
              <dd>{nextDue === null ? '暂无' : formatDue(nextDue)}</dd>
            </div>
          </dl>
          <div className="summary__actions">
            <a className="btn btn--primary btn--block" href={hrefFor('/')}>
              返回首页
            </a>
            <button type="button" className="btn btn--block" onClick={() => startNewSession(false)}>
              再来一轮
            </button>
          </div>
          <p className="muted small">
            进度已保存到本机，刷新或离线都不会丢失。热门快捷方式：空格翻面 / 1–4 评分。
          </p>
        </section>
      )}

      {session && !finished && !empty && !card && (
        <section className="summary summary--notice" aria-label="内容缺失">
          <h2 className="summary__title">卡片内容缺失</h2>
          <p className="muted">
            本次队列里的卡片在当前内容中找不到（可能是内容更换了卡片 id）。重新同步内容后会重新开始。
          </p>
          <a className="btn btn--block" href={hrefFor('/')}>
            返回首页
          </a>
        </section>
      )}

      {session && !finished && card && current && (
        <>
          <CardView
            card={card}
            flipped={flipped}
            revealed={revealed}
            onRevealBlank={handleRevealBlank}
            choice={choice}
            onChoose={handleChoose}
            onFlip={handleFlip}
          />

          <div className="rating-slot">
            {flipped ? (
              <RatingBar previews={previews} suggested={suggested} onRate={rate} disabled={busy} />
            ) : (
              <p className="rating-placeholder">
                {card.type === 'mcq' ? '选择上方选项后评分' : card.type === 'cloze' ? '揭晓后按 1–4 评分' : '翻面后按 1–4 评分'}
              </p>
            )}
          </div>
        </>
      )}

      {empty && !bootError && (
        <section className="empty-state">
          <h2>今天没有需要学习的卡片</h2>
          {queueInfo && queueInfo.limitedBy.length > 0 ? (
            <p className="muted">
              每日上限已用完（新卡 {settings.newPerDay} / 复习 {settings.reviewPerDay}），
              可以到设置里调整，或现在提前学习。
            </p>
          ) : (
            <p className="muted">
              所有卡片都已排进复习队列。{nextDue === null ? '' : `下次到期：${formatDue(nextDue)}。`}
            </p>
          )}
          <div className="summary__actions">
            <button type="button" className="btn btn--primary btn--block" onClick={() => startNewSession(true)}>
              提前学习新卡
            </button>
            <a className="btn btn--block" href={hrefFor('/')}>
              返回首页
            </a>
          </div>
        </section>
      )}
    </div>
  )
}
