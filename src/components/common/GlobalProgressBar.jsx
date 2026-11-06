import { useEffect, useState } from 'react'
import { useIsFetching, useIsMutating } from '@tanstack/react-query'

// Barra de progreso global en el top de la página.
// - No bloquea la pantalla (pointer-events: none) ni usa backdrop.
// - Se enciende con queries/mutaciones EN CURSO.
// - Ignora mutaciones pausadas del outbox offline (si no, la barra nunca se apaga).
export function GlobalProgressBar() {
  const fetching = useIsFetching()
  const mutating = useIsMutating({
    predicate: (mutation) =>
      mutation.state.status === 'pending' && !mutation.state.isPaused,
  })
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
