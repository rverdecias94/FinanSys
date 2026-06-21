import { describe, it, expect, vi, afterEach } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConfirmDeleteUserDialog } from './ConfirmDeleteUserDialog'

afterEach(() => cleanup())

const target = { user_id: 'u1', email: 'biz@x.com' }
const preview = {
  email: 'biz@x.com',
  total_rows: 7,
  counts: { transactions: 3, payments: 1, subscriptions: 1, audit_logs: 2, products: 0 }
}

const deleteBtn = () => screen.getByRole('button', { name: /Eliminar definitivamente/i })

describe('ConfirmDeleteUserDialog', () => {
  it('muestra el impacto del borrado (conteos y total)', () => {
    render(<ConfirmDeleteUserDialog open target={target} preview={preview} loadingPreview={false} submitting={false} onConfirm={vi.fn()} />)
    expect(screen.getByText('7 registro(s)')).toBeInTheDocument()
    expect(screen.getByText('Transacciones')).toBeInTheDocument()
    // Las tablas con 0 filas no se listan.
    expect(screen.queryByText('Productos')).not.toBeInTheDocument()
  })

  it('mantiene deshabilitado "Eliminar definitivamente" hasta escribir el email exacto', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    render(<ConfirmDeleteUserDialog open target={target} preview={preview} loadingPreview={false} submitting={false} onConfirm={onConfirm} />)

    expect(deleteBtn()).toBeDisabled()

    const input = screen.getByPlaceholderText('email del negocio')
    await user.type(input, 'otro@correo.com')
    expect(deleteBtn()).toBeDisabled()

    await user.clear(input)
    await user.type(input, 'biz@x.com')
    expect(deleteBtn()).toBeEnabled()

    await user.click(deleteBtn())
    expect(onConfirm).toHaveBeenCalledWith({ targetUserId: 'u1' })
  })

  it('acepta el email con espacios y mayúsculas (normalizado)', async () => {
    const user = userEvent.setup()
    render(<ConfirmDeleteUserDialog open target={target} preview={preview} loadingPreview={false} submitting={false} onConfirm={vi.fn()} />)
    await user.type(screen.getByPlaceholderText('email del negocio'), '  BIZ@X.COM  ')
    expect(deleteBtn()).toBeEnabled()
  })

  it('muestra el estado de carga del impacto', () => {
    render(<ConfirmDeleteUserDialog open target={target} preview={null} loadingPreview submitting={false} onConfirm={vi.fn()} />)
    expect(screen.getByText(/Calculando impacto/i)).toBeInTheDocument()
    expect(deleteBtn()).toBeDisabled()
  })
})
