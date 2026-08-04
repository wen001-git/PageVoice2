import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(() => ({
  base: '/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icons/icon-192.svg', 'icons/icon-512.svg'],
      manifest: {
        name: 'PageVoice 英文拍照读书',
        short_name: 'PageVoice',
        description: '在浏览器本地识别英文书页，逐句朗读并离线查词。',
        theme_color: '#356859',
        background_color: '#F4F1E8',
        display: 'standalone',
        start_url: './',
        scope: './',
        icons: [
          { src: 'icons/icon-192.svg', sizes: '192x192', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icons/icon-512.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any maskable' }
        ]
      },
      workbox: {
        cleanupOutdatedCaches: true,
        navigateFallback: 'index.html',
        globPatterns: ['**/*.{js,css,html,svg}'],
        globIgnores: ['dictionary/**', 'tessdata/**', 'tesseract-core/**'],
        maximumFileSizeToCacheInBytes: 18 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.includes('/tessdata/') || url.pathname.includes('/tesseract-core/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'pagevoice-ocr-v2',
              expiration: { maxEntries: 16, maxAgeSeconds: 60 * 60 * 24 * 365 }
            }
          },
          {
            urlPattern: ({ url }) => url.pathname.includes('/dictionary/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'pagevoice-dictionary-v1',
              expiration: { maxEntries: 700, maxAgeSeconds: 60 * 60 * 24 * 365 }
            }
          }
        ]
      }
    })
  ],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts'
  }
}))
