import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// Relative base works on any GitHub Pages repository path; HashRouter needs no rewrites.
export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'robots.txt'],
      workbox: { globPatterns: ['**/*.{js,css,html,svg,woff2,woff,png}'] },
      manifest: {
        name: 'FENATRAN 2026 Benchmark',
        short_name: 'FENATRAN',
        description: 'Offline benchmark evaluations for FENATRAN 2026',
        lang: 'en',
        theme_color: '#202A44',
        background_color: '#FFFFFF',
        display: 'standalone',
        start_url: './',
        scope: './',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
})
