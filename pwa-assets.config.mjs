import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// Genera los iconos de la PWA desde public/logo_ico.png (la "G" cuadrada de marca).
// - transparent (any): fondo transparente, para launchers que no enmascaran.
// - maskable: fondo BLANCO + padding amplio para que la "G" quede dentro de la
//   "zona segura" circular de Android (si no, se le cortan las puntas del hexágono).
// - apple: fondo blanco (iOS no admite transparencia: mostraría negro).
export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    maskable: {
      sizes: [512],
      padding: 0.4,
      resizeOptions: { background: '#ffffff', fit: 'contain' },
    },
    apple: {
      sizes: [180],
      padding: 0.3,
      resizeOptions: { background: '#ffffff', fit: 'contain' },
    },
  },
  images: ['public/logo_ico.png'],
})
