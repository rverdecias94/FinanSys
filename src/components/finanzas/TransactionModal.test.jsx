import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TransactionModal } from './TransactionModal'

// Cobertura de P1.1 (cableado de la prop `currencies`) y P1.2 (modo solo-lectura).
// El modal es autocontenido (recibe todo por props, usa react-hook-form interno),
// así que se renderiza sin providers. El cleanup global vive en setupTests.js.

const baseProps = {
  open: true,
  onOpenChange: () => {},
  onSubmit: vi.fn(),
}

describe('TransactionModal — solo lectura (P1.2)', () => {
  it('en readonly muestra "Ver Movimiento", solo el botón Cerrar y los campos deshabilitados', () => {
    render(
      <TransactionModal
        {...baseProps}
        currencies={[{ code: 'USD', is_default: true }]}
        readonly
      />
    )

    expect(screen.getByText('Ver Movimiento')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cerrar' })).toBeInTheDocument()
    // No debe existir vía para guardar/editar desde "Ver".
    expect(screen.queryByRole('button', { name: 'Revisar Datos' })).not.toBeInTheDocument()
    // El <fieldset disabled> deshabilita los controles (toBeDisabled mira el fieldset ancestro).
    expect(screen.getByPlaceholderText('0.00')).toBeDisabled()
  })

  it('en modo editable muestra "Revisar Datos" y los campos habilitados', () => {
    render(
      <TransactionModal
        {...baseProps}
        currencies={[{ code: 'USD', is_default: true }]}
      />
    )

    expect(screen.getByRole('button', { name: 'Revisar Datos' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cerrar' })).not.toBeInTheDocument()
    expect(screen.getByPlaceholderText('0.00')).toBeEnabled()
  })
})

describe('TransactionModal — moneda (P1.1)', () => {
  it('usa la moneda por defecto del negocio (no el USD fijo) cuando se pasa `currencies`', () => {
    render(
      <TransactionModal
        {...baseProps}
        currencies={[{ code: 'EUR', is_default: true }, { code: 'USD' }]}
      />
    )

    // El "Total Estimado" refleja la moneda activa = EUR, demostrando que la prop
    // `currencies` gobierna el valor por defecto (antes caía a USD por el bug de prop).
    expect(screen.getByText(/0\.00\s+EUR/)).toBeInTheDocument()
  })
})

describe('TransactionModal — período cerrado', () => {
  it('abre en solo lectura un movimiento dentro del cierre (sin Revisar Datos)', () => {
    render(
      <TransactionModal
        {...baseProps}
        currencies={[{ code: 'USD', is_default: true }]}
        closedThrough="2026-10-31"
        transaction={{
          id: 42,
          type: 'expense',
          date: '2026-10-30',
          amount: 10,
          currency: 'USD',
          category: 'Servicios',
          description: 'Gasto cerrado',
        }}
      />
    )

    expect(screen.getByText('Ver Movimiento')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(/Período cerrado hasta 31\/10\/2026/)
    expect(screen.queryByRole('button', { name: 'Revisar Datos' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cerrar' })).toBeInTheDocument()
  })

  it('bloquea guardar si la fecha por defecto cae en el cierre (alta)', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 9, 15)) // 15/10/2026 dentro del cierre
    try {
      render(
        <TransactionModal
          {...baseProps}
          currencies={[{ code: 'USD', is_default: true }]}
          closedThrough="2026-10-31"
        />
      )
      expect(screen.getByRole('status')).toHaveTextContent(/Elige una fecha posterior/)
      expect(screen.getByRole('button', { name: 'Revisar Datos' })).toBeDisabled()
    } finally {
      vi.useRealTimers()
    }
  })
})
