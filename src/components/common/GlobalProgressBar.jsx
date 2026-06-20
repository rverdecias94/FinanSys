import { useEffect, useState } from 'react'
import { useIsFetching, useIsMutating } from '@tanstack/react-query'

// Barra de progreso global en el top de la página.
// - No bloquea la pantalla (pointer-events: none) ni usa backdrop.
// - Se enciende automáticamente cuando hay CUALQUIER query o mutación de React
//   Query en curso (cubre toda la app sin tocar cada componente).
// - Pequeño retardo al apagar para que la animación se vea fluida y no parpadee.
export function GlobalProgressBar() {
  const fetching = useIsFetching()
  const mutating = useIsMutating()
  const active = fetching + mutating > 0

  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (active) {
      setVisible(true)
      return
    }
    const timeout = setTimeout(() => setVisible(false), 350)
    return () => clearTimeout(timeout)
  }, [active])

  if (!visible) return null

  return (
    <div className="global-progress-track" role="progressbar" aria-label="Operación en curso" aria-busy="true">
      <div className="global-progress-bar" />
    </div>
  )
}
