import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// Iconos PWA desde logo_ico_tight.png (G recortada, sin margen enorme).
// - transparent / favicon: casi a lleno → se ve grande en pestaña y barra de tareas.
// - maskable: padding amplio + fondo blanco (zona segura Android).
// - apple: fondo blanco (iOS no admite transparencia).
export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    transparent: {
      sizes: [64, 192, 512],
      // Margen mínimo: la G debe dominar el favicon/taskbar.
      padding: 0.04,
      resizeOptions: { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } },
    },
    maskable: {
      sizes: [512],
      padding: 0.2,
      resizeOptions: { background: '#ffffff', fit: 'contain' },
    },
    apple: {
      sizes: [180],
      padding: 0.08,
      resizeOptions: { background: '#ffffff', fit: 'contain' },
    },
  },
  images: ['public/logo_ico_tight.png'],
})
