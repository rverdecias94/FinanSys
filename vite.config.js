import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { VitePWA } from 'vite-plugin-pwa';

/** Id único por build → version.json + __GESTIA_BUILD_ID__ (reload PWA rápido). */
const GESTIA_BUILD_ID = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

// https://vitejs.dev/config/
export default defineConfig({
  define: {
    __GESTIA_BUILD_ID__: JSON.stringify(GESTIA_BUILD_ID),
  },
  plugins: [
    react(),
    {
      name: 'gestia-version-json',
      generateBundle() {
        this.emitFile({
          type: 'asset',
          fileName: 'version.json',
          source: JSON.stringify({ buildId: GESTIA_BUILD_ID }),
        });
      },
    },
    // PWA (Capa A): la app se cachea y abre sin conexión, es instalable y se
    // actualiza sola. NO toca la lógica de negocio. Ver docs/PLAN_OFFLINE_PWA.md.
    VitePWA({
      // autoUpdate + registerSW (src/offline/registerPwaUpdate.js) recarga sola
      // al detectar un SW nuevo. injectRegister false evita doble registro.
      registerType: 'autoUpdate',
      injectRegister: false,
      // Sufijo -v5: any transparente (sin rayas blancas laterales) + cache-bust.
      includeAssets: ['favicon-v5.ico', 'apple-touch-icon-180x180-v5.png'],
      manifest: {
        name: 'Gestia',
        short_name: 'Gestia',
        description: 'Gestión de caja, cobros/pagos e inventario para tu negocio, simple y sin complicaciones.',
        lang: 'es',
        // Barras del sistema en PWA instalada. ThemeContext ajusta el meta en runtime
        // (claro/oscuro). Default oscuro: coincide con el uso habitual y evita la
        // franja blanca de Android Chrome al abrir en standalone.
        theme_color: '#121212',
        background_color: '#121212',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'pwa-64x64-v5.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192-v5.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512-v5.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512-v5.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Web Push: handlers en public/push-handler.js (app cerrada / PWA).
        importScripts: ['/push-handler.js'],
        // Fallback SPA (compatible con public/_redirects de Netlify).
        navigateFallback: '/index.html',
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        // No precachear las librerías de exportación (~1.5 MB: jspdf/xlsx/docx). Ya no
        // se cargan en el arranque (imports dinámicos en Reportes/almacen/inventario);
        // se descargan solo al exportar y quedan cacheadas (runtimeCaching abajo). Así
        // la instalación de la PWA es más ligera — clave en Cuba (datos caros).
        // export-vendor: lazy CacheFirst. version.json: nunca precache (NetworkOnly).
        globIgnores: ['**/export-vendor-*.js', '**/version.json'],
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
          {
            urlPattern: ({ url }) => url.pathname.endsWith('/version.json'),
            handler: 'NetworkOnly',
          },
          {
            // El chunk de exportación no va en el precache (ver globIgnores): se
            // descarga la primera vez que se exporta y queda cacheado, para que
            // exportar siga funcionando sin conexión a partir de entonces.
            urlPattern: ({ url }) => /\/assets\/export-vendor-.*\.js$/.test(url.pathname),
            handler: 'CacheFirst',
            options: {
              cacheName: 'export-vendor-lazy',
              expiration: { maxEntries: 3, maxAgeSeconds: 60 * 60 * 24 * 90 },
            },
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
          // El helper de precarga de Vite lo usa el entry para cargar TODAS las rutas
          // lazy; si Rollup lo agrupa dentro de un vendor pesado (export-vendor), el
          // entry arrastra ese peso al arranque. Lo aislamos en un chunk minúsculo.
          if (id.includes('preload-helper')) return 'vite-preload'
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
    setupFiles: ['./src/tests/setupTests.js'],
    // El entorno jsdom de este equipo es lento (setup/environment ~30-60s); el
    // timeout por defecto de 5s producía flakiness en tests de integración UI.
    testTimeout: 15000,
    hookTimeout: 15000
  }
});
