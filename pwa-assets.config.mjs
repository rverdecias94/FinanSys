import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// Iconos PWA desde logo_ico_fill.png (G recortada al contenido, sin margen muerto).
// - any (transparent preset): fondo BLANCO sólido → Windows/Android rellenan el
//   hueco de la barra; con transparencia el hexágono se ve diminuto vs PayPal/etc.
// - maskable: padding amplio + fondo blanco (zona segura Android).
// - apple: fondo blanco (iOS no admite transparencia).
export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    transparent: {
      sizes: [64, 192, 512],
      padding: 0.06,
      resizeOptions: { fit: 'contain', background: '#ffffff' },
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
