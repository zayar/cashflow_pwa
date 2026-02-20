import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true
      },
      includeAssets: ['favicon.svg', 'favicon.ico', 'simplecashflow_logo.png'],
      manifest: {
        name: 'Cashfloweasy — Simple Accounting',
        short_name: 'Cashfloweasy',
        start_url: '/',
        display: 'standalone',
        background_color: '#0f172a',
        theme_color: '#2563eb',
        icons: [
          {
            src: '/favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any'
          },
          {
            src: '/simplecashflow_logo.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
  server: {
    port: 4173
  }
});
