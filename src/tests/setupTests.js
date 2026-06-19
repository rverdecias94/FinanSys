import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// Cleanup global tras cada test (P5.1): desmonta el árbol renderizado y limpia el
// DOM de jsdom entre tests. Sin esto, los componentes de un test anterior pueden
// quedar en el documento y volver ambiguos selectores como
// getByRole('button', { name: 'Solicitar Premium' }) → fuente del flake histórico
// de PlansPanel.test.jsx. Centralizarlo aquí evita tener que repetir afterEach(cleanup)
// en cada archivo de test.
afterEach(() => {
  cleanup()
})

