import type { ReactElement } from 'react'
import { hrefFor } from '../lib/router'

interface Tab {
  path: string
  label: string
  icon: ReactElement
  match: (path: string) => boolean
}

const tabs: Tab[] = [
  {
    path: '/',
    label: '学习',
    match: (path) => path === '/' || path.startsWith('/study'),
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M4 5.5A2.5 2.5 0 016.5 3H20v15H6.5A2.5 2.5 0 004 20.5z" />
        <path d="M20 18v3H6.5A2.5 2.5 0 014 18.5" />
      </svg>
    ),
  },
  {
    path: '/stats',
    label: '统计',
    match: (path) => path.startsWith('/stats'),
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M4 20V10M10 20V4M16 20v-6M22 20H2" />
      </svg>
    ),
  },
  {
    path: '/settings',
    label: '设置',
    match: (path) => path.startsWith('/settings'),
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <circle cx="12" cy="12" r="3.2" />
        <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.2 5.2l2.1 2.1M16.7 16.7l2.1 2.1M18.8 5.2l-2.1 2.1M7.3 16.7l-2.1 2.1" />
      </svg>
    ),
  },
]

export function TabBar({ path }: { path: string }) {
  return (
    <nav className="tabbar" aria-label="主导航">
      {tabs.map((tab) => {
        const active = tab.match(path)
        return (
          <a
            key={tab.path}
            className={`tabbar__item${active ? ' is-active' : ''}`}
            href={hrefFor(tab.path)}
            aria-current={active ? 'page' : undefined}
          >
            <span className="tabbar__icon">{tab.icon}</span>
            <span className="tabbar__label">{tab.label}</span>
          </a>
        )
      })}
    </nav>
  )
}
