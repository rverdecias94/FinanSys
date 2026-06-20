import { describe, it, expect, vi, afterEach } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RecordPaymentDialog } from './RecordPaymentDialog'
import { SetPaymentDateDialog } from './SetPaymentDateDialog'

afterEach(() => cleanup())

describe('RecordPaymentDialog', () => {
  it('confirma con el payload por defecto (mensual, $10, transferencia)', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    render(
      <RecordPaymentDialog
        open
        business={{ business_id: 'b1', email: 'x@y.com', billing_cycle: 'monthly' }}
        submitting={false}
        onConfirm={onConfirm}
      />
    )
    await user.click(screen.getByRole('button', { name: 'Registrar pago' }))
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({
      businessId: 'b1',
      amount: 10,
      billingCycle: 'monthly',
      method: 'transferencia'
    }))
  })
})

describe('SetPaymentDateDialog', () => {
  it('confirma con la fecha de vencimiento actual del negocio', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    render(
      <SetPaymentDateDialog
        open
        business={{ business_id: 'b1', email: 'x@y.com', current_period_end: '2027-01-15T00:00:00.000Z' }}
        submitting={false}
        onConfirm={onConfirm}
      />
    )
    await user.click(screen.getByRole('button', { name: 'Guardar fecha' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    const payload = onConfirm.mock.calls[0][0]
    expect(payload.businessId).toBe('b1')
    expect(payload.newPeriodEnd).toBeTruthy()
  })
})
