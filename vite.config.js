import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
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
    environment: 'jsdom',
    setupFiles: ['./src/tests/setupTests.js']
  }
});
