import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// Iconos PWA desde logo_ico_fill.png (G recortada al contenido).
// - any: fondo TRANSPARENTE (sin letterbox blanco → no “rayas” laterales en Chrome oscuro).
// - maskable/apple: blanco a sangre (zona segura / iOS).
// Nota: los PNG de producción se generan con scripts/sharp (v5+); este config
// documenta la intención si se vuelve a usar pwa-assets-generator.
export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    transparent: {
      sizes: [64, 192, 512],
      padding: 0.03,
      resizeOptions: { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } },
    },
    maskable: {
      sizes: [512],
      padding: 0.18,
      resizeOptions: { background: '#ffffff', fit: 'contain' },
    },
    apple: {
      sizes: [180],
      padding: 0.06,
      resizeOptions: { background: '#ffffff', fit: 'contain' },
    },
  },
  images: ['public/logo_ico_fill.png'],
})
