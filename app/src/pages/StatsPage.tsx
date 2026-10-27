import { useMemo } from 'react'
import { decks } from '../content'
import { ErrorNotice } from '../components/ErrorNotice'
import { loadLogs, loadSettings, loadStateMap } from '../lib/db'
import { dayKey } from '../lib/dates'
import { dailyActivity, deckStats, overview } from '../lib/stats'
import { useAsyncData } from '../lib/store'

export function StatsPage() {
  const now = Date.now()
  const today = dayKey()
  const { data, error } = useAsyncData(async () => {
    const [states, logs, settings] = await Promise.all([loadStateMap(), loadLogs(), loadSettings()])
    return { states, logs, settings }
  })

  const summary = useMemo(() => (data ? overview(decks, data.states, data.logs, now, today) : null), [data, now, today])
  const buckets = useMemo(() => (data ? dailyActivity(data.logs, today, 7) : []), [data, today])
  const perDeck = useMemo(() => (data ? decks.map((deck) => deckStats(deck, data.states, now)) : []), [data, now])
  const maxCount = Math.max(1, ...buckets.map((bucket) => bucket.count))
  const weekTotal = buckets.reduce((sum, bucket) => sum + bucket.count, 0)

  return (
    <div className="page">
      <header className="page__header">
        <div>
          <p className="eyebrow">统计</p>
          <h1 className="page__title">学习数据</h1>
        </div>
        <p className="page__subtitle">数据只存在这台设备上。</p>
      </header>

      {error && <ErrorNotice message={`读取统计失败：${error}`} />}

      <section className="tiles" aria-label="总体数据">
        <div className="tile">
          <span className="tile__value">{summary?.totalCards ?? '—'}</span>
          <span className="tile__label">总卡片</span>
        </div>
        <div className="tile">
          <span className="tile__value">{summary?.mastered ?? '—'}</span>
          <span className="tile__label">已掌握</span>
        </div>
        <div className="tile">
          <span className="tile__value">{summary?.dueNow ?? '—'}</span>
          <span className="tile__label">今日到期</span>
        </div>
        <div className="tile">
          <span className="tile__value">{summary?.reviewedToday ?? '—'}</span>
          <span className="tile__label">今日已复习</span>
        </div>
      </section>

      <section className="mini-stats" aria-label="连续与正确率">
        <div>
          <span className="mini-stats__value">{summary?.streak ?? 0}</span>
          <span className="mini-stats__label">连续天数</span>
        </div>
        <div>
          <span className="mini-stats__value">
            {summary?.accuracyToday === null || summary?.accuracyToday === undefined
              ? '—'
              : `${Math.round(summary.accuracyToday * 100)}%`}
          </span>
          <span className="mini-stats__label">今日正确率</span>
        </div>
        <div>
          <span className="mini-stats__value">{weekTotal}</span>
          <span className="mini-stats__label">近 7 天复习</span>
        </div>
      </section>

      <section className="section" aria-labelledby="chart-title">
        <div className="section__head">
          <h2 id="chart-title" className="section__title">
            近 7 天复习量
          </h2>
          <span className="muted small">共 {weekTotal} 张</span>
        </div>
        <div className="chart" role="img" aria-label={`近 7 天共复习 ${weekTotal} 张，最多的一天 ${maxCount} 张`}>
          {buckets.map((bucket) => (
            <div className="chart__col" key={bucket.day}>
              <span className="chart__count" aria-hidden="true">
                {bucket.count > 0 ? bucket.count : ''}
              </span>
              <div className="chart__track">
                <span
                  className={`chart__bar${bucket.day === today ? ' is-today' : ''}${bucket.count === 0 ? ' is-empty' : ''}`}
                  style={{ height: `${bucket.count === 0 ? 3 : Math.max(8, (bucket.count / maxCount) * 100)}%` }}
                  title={`${bucket.day}：${bucket.count} 张`}
                />
              </div>
              <span className="chart__label">{bucket.label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="section" aria-labelledby="deck-progress-title">
        <div className="section__head">
          <h2 id="deck-progress-title" className="section__title">
            每 Deck 进度
          </h2>
        </div>
        <ul className="deck-progress">
          {perDeck.map((stats) => (
            <li key={stats.deckId} className="deck-progress__item">
              <div className="deck-progress__head">
                <span className="deck-progress__title">{stats.title}</span>
                <span className="muted small">
                  已学 {stats.total - stats.fresh} / {stats.total}
                </span>
              </div>
              <div className="bar" role="presentation">
                <span className="bar__fill" style={{ width: `${Math.round(stats.progress * 100)}%` }} />
              </div>
              <div className="deck-progress__counts">
                <span className="chip chip--new">新 {stats.fresh}</span>
                <span className="chip chip--learning">学 {stats.learning}</span>
                <span className={`chip ${stats.due > 0 ? 'chip--due' : 'chip--muted'}`}>待复习 {stats.due}</span>
                <span className="chip chip--muted">已掌握 {stats.mastered}</span>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
