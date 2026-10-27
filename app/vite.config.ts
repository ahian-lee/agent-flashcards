import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

/**
 * Deploy under a sub-path (GitHub Pages project site, S3 prefix, …) with:
 *   BASE_PATH=/my-repo/ npm run build
 * Hash routing keeps `index.html` as the only entry point, so no server-side
 * rewrite rules are required anywhere.
 */
const base = process.env.BASE_PATH ?? '/'

export default defineConfig({
  base,
  build: {
    target: 'es2022',
    sourcemap: false,
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'icons/*.png'],
      manifest: {
        name: 'Agent 闪卡',
        short_name: 'Agent闪卡',
        description: '像背单词一样学习 Agent 知识：FSRS 间隔重复、可安装、可离线。',
        lang: 'zh-CN',
        dir: 'ltr',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#4f46e5',
        background_color: '#0b1220',
        categories: ['education', 'productivity'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest,woff2}'],
        // every navigation resolves to the cached shell (hash routing needs nothing more)
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
})
