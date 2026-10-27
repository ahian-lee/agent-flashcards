import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App'
import { applyTheme } from './lib/settings'

// The inline script in index.html already picked a theme before first paint;
// this re-applies it through the single code path (and covers the no-script case).
applyTheme('auto')

registerSW({
  immediate: true,
  onOfflineReady() {
    console.info('[Agent 闪卡] 离线缓存就绪，断网后刷新仍可使用。')
  },
  onRegisterError(error) {
    console.warn('[Agent 闪卡] Service Worker 注册失败', error)
  },
})

const container = document.getElementById('root')
if (!container) throw new Error('#root 容器缺失')

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
