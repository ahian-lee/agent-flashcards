import { useEffect } from 'react'
import { ErrorBoundary } from './components/ErrorBoundary'
import { TabBar } from './components/TabBar'
import { ToastProvider } from './components/Toast'
import { loadSettings } from './lib/db'
import { useRoute } from './lib/router'
import { applyTheme } from './lib/settings'
import { useAsyncData } from './lib/store'
import { HomePage } from './pages/HomePage'
import { SettingsPage } from './pages/SettingsPage'
import { StatsPage } from './pages/StatsPage'
import { StudyPage } from './pages/StudyPage'

function currentPath(): string {
  if (typeof window === 'undefined') return '/'
  const raw = window.location.hash.replace(/^#/, '')
  return raw || '/'
}

function NotFoundPage({ path }: { path: string }) {
  return (
    <div className="page">
      <header className="page__header">
        <h1 className="page__title">页面不存在</h1>
        <p className="page__subtitle">
          <code>{path}</code> 不是一个有效页面。
        </p>
      </header>
      <a className="btn btn--primary btn--block" href="#/">
        回到首页
      </a>
    </div>
  )
}

export default function App() {
  const route = useRoute()
  const path = currentPath()
  const { data: themeMode } = useAsyncData(() => loadSettings().then((settings) => settings.theme))

  useEffect(() => {
    if (themeMode) applyTheme(themeMode)
  }, [themeMode])

  // keep `auto` in sync with OS-level theme changes
  useEffect(() => {
    if (themeMode !== 'auto' || typeof window.matchMedia !== 'function') return
    const query = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => applyTheme('auto')
    query.addEventListener('change', handler)
    return () => query.removeEventListener('change', handler)
  }, [themeMode])

  return (
    <ErrorBoundary>
      <ToastProvider>
        <div className="app">
          <main className="app__main" id="main">
            {route.name === 'home' && <HomePage />}
            {route.name === 'study' && <StudyPage key={route.deckId ?? 'mixed'} deckId={route.deckId} />}
            {route.name === 'stats' && <StatsPage />}
            {route.name === 'settings' && <SettingsPage />}
            {route.name === 'not-found' && <NotFoundPage path={route.path} />}
          </main>
          <TabBar path={path} />
        </div>
      </ToastProvider>
    </ErrorBoundary>
  )
}
