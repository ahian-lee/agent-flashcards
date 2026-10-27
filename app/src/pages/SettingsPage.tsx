import { useEffect, useRef, useState } from 'react'
import { ErrorNotice } from '../components/ErrorNotice'
import { Stepper } from '../components/Stepper'
import { useToast } from '../components/Toast'
import {
  clearProgress,
  describeDbError,
  estimateStorage,
  importSnapshot,
  loadSettings,
  loadSnapshot,
  requestPersistentStorage,
  saveSettings,
} from '../lib/db'
import { dayKey } from '../lib/dates'
import { buildExport, validateImport } from '../lib/importExport'
import { applyTheme, SETTING_LIMITS, THEME_LABELS, THEME_MODES } from '../lib/settings'
import type { Settings, ThemeMode } from '../lib/settings'
import { notifyDbChanged } from '../lib/store'

function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)))
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`
}

export function SettingsPage() {
  const toast = useToast()
  const [settings, setSettings] = useState<Settings | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const [busy, setBusy] = useState(false)
  const [storage, setStorage] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    void (async () => {
      try {
        const loaded = await loadSettings()
        setSettings(loaded)
        applyTheme(loaded.theme)
        const estimate = await estimateStorage()
        if (estimate && estimate.usage > 0) setStorage(`${formatBytes(estimate.usage)} / ${formatBytes(estimate.quota)}`)
      } catch (err) {
        setError(describeDbError(err))
      }
    })()
    void requestPersistentStorage()
  }, [])

  const update = (patch: Partial<Settings>) => {
    setSettings((previous) => {
      if (!previous) return previous
      const next = { ...previous, ...patch }
      if (patch.theme) applyTheme(patch.theme)
      return next
    })
    void saveSettings(patch)
      .then((saved) => {
        setSettings(saved)
        notifyDbChanged()
      })
      .catch((err: unknown) => toast.error(describeDbError(err)))
  }

  const handleExport = async () => {
    setBusy(true)
    try {
      const snapshot = await loadSnapshot()
      const payload = buildExport(snapshot.cardStates, snapshot.settings, snapshot.reviewLogs)
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `agent-flashcards-${dayKey()}.json`
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1500)
      toast.success(`已导出 ${payload.cardStates.length} 条进度、${payload.reviewLogs.length} 条复习记录`)
    } catch (err) {
      toast.error(describeDbError(err))
    } finally {
      setBusy(false)
    }
  }

  const handleFile = async (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    try {
      const text = await file.text()
      let parsed: unknown
      try {
        parsed = JSON.parse(text)
      } catch {
        toast.error('导入失败：文件不是合法的 JSON')
        return
      }
      const result = validateImport(parsed)
      if (!result.ok) {
        toast.error(`导入失败：${result.error}`)
        return
      }
      if (result.data.cardStates.length === 0 && result.data.reviewLogs.length === 0) {
        toast.error('导入失败：文件里没有进度数据')
        return
      }
      const summary = await importSnapshot(result.data)
      notifyDbChanged()
      const loaded = await loadSettings()
      setSettings(loaded)
      applyTheme(loaded.theme)
      toast.success(
        `导入成功：新增 ${summary.added}、更新 ${summary.updated}、保留较新 ${summary.kept}、复习记录 ${summary.logsAdded}`,
      )
    } catch (err) {
      toast.error(describeDbError(err))
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const handleReset = async () => {
    setBusy(true)
    try {
      await clearProgress()
      const fresh = await loadSettings()
      setSettings(fresh)
      applyTheme(fresh.theme)
      notifyDbChanged()
      setConfirmReset(false)
      toast.success('学习进度已重置')
    } catch (err) {
      toast.error(describeDbError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page">
      <header className="page__header">
        <div>
          <p className="eyebrow">设置</p>
          <h1 className="page__title">偏好与数据</h1>
        </div>
      </header>

      {error && <ErrorNotice message={error} />}

      <section className="section" aria-labelledby="plan-title">
        <h2 id="plan-title" className="section__title">
          学习计划
        </h2>
        {settings ? (
          <div className="card-block">
            <Stepper
              id="new-per-day"
              label="每日新卡上限"
              hint="决定每天最多引入多少张没学过的卡"
              value={settings.newPerDay}
              min={SETTING_LIMITS.newPerDay.min}
              max={SETTING_LIMITS.newPerDay.max}
              step={SETTING_LIMITS.newPerDay.step}
              onChange={(value) => update({ newPerDay: value })}
            />
            <Stepper
              id="review-per-day"
              label="每日复习上限"
              hint="到期卡片的展示上限，超出部分留到明天"
              value={settings.reviewPerDay}
              min={SETTING_LIMITS.reviewPerDay.min}
              max={SETTING_LIMITS.reviewPerDay.max}
              step={SETTING_LIMITS.reviewPerDay.step}
              onChange={(value) => update({ reviewPerDay: value })}
            />
            <Stepper
              id="learn-ahead"
              label="提前学习窗口（分钟）"
              hint="刚评为「记得/忘了」的短周期卡片，在这个时间内可以继续复习"
              value={settings.learnAheadMinutes}
              min={SETTING_LIMITS.learnAheadMinutes.min}
              max={SETTING_LIMITS.learnAheadMinutes.max}
              step={SETTING_LIMITS.learnAheadMinutes.step}
              onChange={(value) => update({ learnAheadMinutes: value })}
            />
          </div>
        ) : (
          <p className="muted">读取设置中…</p>
        )}
      </section>

      <section className="section" aria-labelledby="theme-title">
        <h2 id="theme-title" className="section__title">
          外观
        </h2>
        <div className="segmented" role="radiogroup" aria-label="主题">
          {THEME_MODES.map((mode) => (
            <button
              key={mode}
              type="button"
              role="radio"
              aria-checked={settings?.theme === mode}
              className={`segmented__item${settings?.theme === mode ? ' is-active' : ''}`}
              onClick={() => update({ theme: mode as ThemeMode })}
            >
              {THEME_LABELS[mode]}
            </button>
          ))}
        </div>
      </section>

      <section className="section" aria-labelledby="data-title">
        <h2 id="data-title" className="section__title">
          数据
        </h2>
        <div className="card-block">
          <div className="data-row">
            <div className="setting-row__text">
              <span className="setting-row__label">导出备份</span>
              <p className="setting-row__hint">把进度、设置与复习记录导出为 JSON 文件</p>
            </div>
            <button type="button" className="btn btn--small" onClick={handleExport} disabled={busy}>
              导出
            </button>
          </div>

          <div className="data-row">
            <div className="setting-row__text">
              <span className="setting-row__label">导入备份</span>
              <p className="setting-row__hint">按卡片合并，较新的记录优先，不会覆盖更新的进度</p>
            </div>
            <button type="button" className="btn btn--small" onClick={() => fileRef.current?.click()} disabled={busy}>
              选择文件
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="visually-hidden"
              aria-label="选择备份文件"
              onChange={(event) => void handleFile(event.target.files?.[0])}
            />
          </div>

          {storage && (
            <div className="data-row data-row--muted">
              <span className="muted small">已用存储：{storage}</span>
            </div>
          )}

          <div className="data-row data-row--danger">
            <div className="setting-row__text">
              <span className="setting-row__label">重置学习进度</span>
              <p className="setting-row__hint">清空所有卡片状态、复习记录和设置，不可撤销</p>
            </div>
            {!confirmReset ? (
              <button type="button" className="btn btn--small btn--danger" onClick={() => setConfirmReset(true)}>
                重置
              </button>
            ) : (
              <div className="confirm-actions">
                <button type="button" className="btn btn--small btn--danger" onClick={handleReset} disabled={busy}>
                  确认重置
                </button>
                <button type="button" className="btn btn--small" onClick={() => setConfirmReset(false)} disabled={busy}>
                  取消
                </button>
              </div>
            )}
          </div>
          {confirmReset && (
            <p className="notice notice--warn" role="alert">
              这会删除本机所有学习进度，建议先导出备份。
            </p>
          )}
        </div>
      </section>

      <section className="section" aria-labelledby="about-title">
        <h2 id="about-title" className="section__title">
          关于
        </h2>
        <div className="card-block about">
          <p>
            本应用用 <strong>FSRS</strong>（Free Spaced Repetition Scheduler，v6 算法，由 ts-fsrs 实现）安排复习：
            每次评分后算法会根据你的记忆稳定性与难度，预测最佳的下次复习时间。
          </p>
          <p>
            四档评分：<strong>忘了 / 困难 / 记得 / 太简单</strong>，分别对应 FSRS 的 Again / Hard / Good / Easy。
            评分越准确，复习计划越省时间。
          </p>
          <p>
            数据<strong>只保存在本机浏览器</strong>（IndexedDB），不上传服务器。清除浏览器数据、换设备或使用无痕模式会丢失进度，
            建议定期导出备份。
          </p>
          <p className="muted small">
            免责声明：卡片内容为学习辅助材料，可能存在错误或过时信息，请以官方文档与面试实际要求为准。
          </p>
          <p className="muted small">版本 1.0.0 · 本地优先 · 可离线使用</p>
        </div>
      </section>
    </div>
  )
}
