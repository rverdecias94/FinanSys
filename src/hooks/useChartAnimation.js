import { useEffect, useState } from 'react'

/**
 * Detecta la preferencia del sistema "reducir movimiento" (accesibilidad).
 */
export function usePrefersReducedMotion() {
  const query = '(prefers-reduced-motion: reduce)'
  const [reduced, setReduced] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia(query).matches
      : false
  )

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mql = window.matchMedia(query)
    const onChange = () => setReduced(mql.matches)
    mql.addEventListener?.('change', onChange)
    return () => mql.removeEventListener?.('change', onChange)
  }, [])

  return reduced
}

/**
 * Props de animación premium para series de Recharts (Bar/Line/Pie/Area).
 * - Animación corta y suave (400ms) en vez del default lento de 1500ms.
 * - Respeta `prefers-reduced-motion` (desactiva si el usuario lo pide).
 * - Desactiva la animación en datasets grandes (evita jank al re-filtrar).
 *
 * Uso: `const chartAnim = useChartAnimation(data.length)` y `{...chartAnim}` en la serie.
 */
export function useChartAnimation(pointCount = 0) {
  const reduced = usePrefersReducedMotion()
  return {
    isAnimationActive: !reduced && pointCount <= 60,
    animationDuration: 400,
    animationEasing: 'ease-out'
  }
}
