import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // PWA (Capa A): la app se cachea y abre sin conexión, es instalable y se
    // actualiza sola. NO toca la lógica de negocio. Ver docs/PLAN_OFFLINE_PWA.md.
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'Gestia',
        short_name: 'Gestia',
        description: 'Gestión financiera y contable para tu negocio, simple y sin complicaciones.',
        lang: 'es',
        theme_color: '#1aa06a',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Fallback SPA (compatible con public/_redirects de Netlify).
        navigateFallback: '/index.html',
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        // El bundle principal supera el tope por defecto (2 MiB) hasta resolver el
        // code-splitting; subimos el límite para que el precache no falle.
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        // NO cachear con el SW las llamadas a Supabase: los datos los gestiona
        // React Query (Capa B). El SW solo precachea el app-shell.
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.hostname.endsWith('supabase.co'),
            handler: 'NetworkOnly',
          },
        ],
      },
      // El service worker solo corre en build/preview, no en `npm run dev`.
      devOptions: { enabled: false },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Agrupa las librerías pesadas en chunks cacheables y bajo demanda (P3.5):
        // gráficas, exportación (PDF/Excel/Word) y Supabase no se cargan en el
        // arranque, solo cuando la ruta que las usa se visita.
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('recharts') || id.includes('d3-') || id.includes('victory-vendor')) return 'charts'
          if (
            id.includes('jspdf') || id.includes('html2canvas') || id.includes('canvg') ||
            id.includes('docx') || id.includes('xlsx') || id.includes('file-saver') ||
            id.includes('dompurify')
          ) return 'export-vendor'
          if (id.includes('@supabase')) return 'supabase'
          if (id.includes('react-router')) return 'router'
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/tests/setupTests.js']
  }
});
