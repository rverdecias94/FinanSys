import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PendingSyncRow } from './PendingSyncRow'

describe('PendingSyncRow', () => {
  it('sin pending renderiza los hijos sin aviso', () => {
    render(
      <PendingSyncRow pending={false}>
        <span>Fila normal</span>
      </PendingSyncRow>,
    )
    expect(screen.getByText('Fila normal')).toBeInTheDocument()
    expect(screen.queryByText(/por sincronizar/i)).not.toBeInTheDocument()
  })

  it('con pending muestra aviso accesible y estilos de advertencia', () => {
    render(
      <PendingSyncRow pending>
        <span>Gasto offline</span>
      </PendingSyncRow>,
    )
    const status = screen.getByRole('status', { name: /pendiente de sincronizar/i })
    expect(status).toBeInTheDocument()
    expect(status).toHaveTextContent(/por sincronizar/i)
    expect(screen.getByText('Gasto offline')).toBeInTheDocument()
  })
})
