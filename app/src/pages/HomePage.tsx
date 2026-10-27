import { useMemo } from 'react'
import { contentSource, decks } from '../content'
import { ProgressRing } from '../components/ProgressRing'
import { loadLogs, loadSettings, loadStateMap, loadTodayCounts } from '../lib/db'
import { dayKey, formatDue } from '../lib/dates'
import { overview, deckStats } from '../lib/stats'
import { useAsyncData } from '../lib/store'
import { hrefFor, studyPath } from '../lib/router'
import { ErrorNotice } from '../components/ErrorNotice'

export function HomePage() {
  const now = Date.now()
  const { data, error } = useAsyncData(async () => {
    const [states, logs, settings, counts] = await Promise.all([
      loadStateMap(),
      loadLogs(),
      loadSettings(),
      loadTodayCounts(),
    ])
    return { states, logs, settings, counts }
  })

  const view = useMemo(() => {
    if (!data) return null
    const summary = overview(decks, data.states, data.logs, now)
    const perDeck = decks.map((deck) => deckStats(deck, data.states, now))
    const goal = data.settings.newPerDay + Math.min(summary.dueNow, data.settings.reviewPerDay)
    const done = summary.reviewedToday
    const ringValue = goal === 0 ? (done > 0 ? 1 : 0) : Math.min(1, done / goal)
    let nextDue: number | null = null
    for (const state of Object.values(data.states)) {
      if (state.due > now && (nextDue === null || state.due < nextDue)) nextDue = state.due
    }
    return { summary, perDeck, goal, done, ringValue, nextDue }
  }, [data, now])

  const totalCards = decks.reduce((sum, deck) => sum + deck.cards.length, 0)

  return (
    <div className="page">
      <header className="page__header">
        <div>
          <p className="eyebrow">{dayKey()}</p>
          <h1 className="page__title">Agent 闪卡</h1>
        </div>
        <p className="page__subtitle">每天几张，像背单词一样吃透 Agent。</p>
      </header>

      {error && <ErrorNotice message={`读取本地进度失败：${error}`} />}

      {contentSource === 'fallback' && (
        <div className="banner banner--info" role="status">
          <strong>当前是内置示例内容</strong>
          <p>
            运行 <code>npm run sync:content</code> 可从 <code>../content/decks</code> 同步完整题库；
            同步后示例内容会自动隐藏。
          </p>
        </div>
      )}
      {contentSource === 'mixed' && (
        <div className="banner banner--info" role="status">
          部分 deck 仍是内置示例内容（真实内容未覆盖该 deck）。
        </div>
      )}

      <section className="hero" aria-label="今日进度">
        <ProgressRing
          value={view?.ringValue ?? 0}
          label={`${view?.done ?? 0}`}
          caption={view ? `/ ${view.goal}` : undefined}
          ariaLabel={`今日已学 ${view?.done ?? 0}，目标 ${view?.goal ?? 0}`}
        />
        <div className="hero__stats">
          <div className="hero__stat">
            <span className="hero__stat-value">{view?.summary.streak ?? 0}</span>
            <span className="hero__stat-label">连续天数</span>
          </div>
          <div className="hero__stat">
            <span className="hero__stat-value">{view?.summary.dueNow ?? 0}</span>
            <span className="hero__stat-label">待复习</span>
          </div>
          <div className="hero__stat">
            <span className="hero__stat-value">{view?.summary.newCards ?? 0}</span>
            <span className="hero__stat-label">未学</span>
          </div>
        </div>
      </section>

      <a className="btn btn--primary btn--block" href={hrefFor('/study')} aria-label="开始今天的学习（混合队列）">
        开始学习
      </a>

      <section className="section" aria-labelledby="decks-title">
        <div className="section__head">
          <h2 id="decks-title" className="section__title">
            Deck
          </h2>
          <span className="muted">{totalCards} 张卡片</span>
        </div>

        {decks.length === 0 && (
          <p className="empty">还没有任何内容。运行 <code>npm run sync:content</code> 同步题库。</p>
        )}

        <ul className="deck-list">
          {decks.map((deck, index) => {
            const stats = view?.perDeck[index]
            const dueSoon = stats?.due ?? 0
            const fresh = stats?.fresh ?? deck.cards.length
            const learning = stats?.learning ?? 0
            const percent = Math.round((stats?.progress ?? 0) * 100)
            return (
              <li key={deck.id}>
                <a className="deck" href={hrefFor(studyPath(deck.id))}>
                  <div className="deck__head">
                    <h3 className="deck__title">
                      {deck.title}
                      {deck.placeholder && <span className="badge badge--ghost">示例</span>}
                    </h3>
                    <span className="deck__percent">{percent}%</span>
                  </div>
                  {deck.description && <p className="deck__desc">{deck.description}</p>}
                  <div className="bar" role="presentation">
                    <span className="bar__fill" style={{ width: `${percent}%` }} />
                  </div>
                  <div className="deck__counts">
                    <span className="chip chip--new">新 {fresh}</span>
                    <span className="chip chip--learning">学 {learning}</span>
                    <span className={`chip ${dueSoon > 0 ? 'chip--due' : 'chip--muted'}`}>待复习 {dueSoon}</span>
                    <span className="muted deck__total">{deck.cards.length} 张</span>
                  </div>
                </a>
              </li>
            )
          })}
        </ul>
      </section>

      {view && view.summary.dueNow === 0 && view.summary.newCards === 0 && (
        <p className="empty">
          全部卡片都已进入复习队列
          {view.nextDue !== null && `，下次到期：${formatDue(view.nextDue, now)}`}。
        </p>
      )}

      {view && view.nextDue !== null && view.summary.dueNow === 0 && view.summary.newCards > 0 && (
        <p className="muted small">已有卡片排进队列，下次到期：{formatDue(view.nextDue, now)}。</p>
      )}
    </div>
  )
}
