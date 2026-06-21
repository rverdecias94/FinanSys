import { describe, it, expect, vi, afterEach } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ConfirmDeleteUserDialog } from './ConfirmDeleteUserDialog'

// Forzar modo desktop (paginación) para un render determinista del listado.
vi.mock('@/hooks/useIsMobile', () => ({ useIsMobile: () => false }))
// Mockear solo la llamada de red; conservar ACCOUNT_STATE real.
vi.mock('@/services/adminUsers', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, listTeamMembers: vi.fn() }
})

import { listTeamMembers } from '@/services/adminUsers'
import { TeamMembersAdminTable } from './TeamMembersAdminTable'

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

function renderWithClient(ui) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}

describe('TeamMembersAdminTable', () => {
  const member = {
    team_member_id: 'tm1',
    member_id: 'm1',
    member_email: 'mem@x.com',
    owner_email: 'own@x.com',
    role: 'Editor',
    membership_status: 'active',
    account_status: 'active'
  }

  it('lista subcuentas y dispara las acciones suspender/eliminar', async () => {
    const user = userEvent.setup()
    listTeamMembers.mockResolvedValue({ data: [member], count: 1 })
    const onSetStatus = vi.fn()
    const onDelete = vi.fn()

    renderWithClient(
      <TeamMembersAdminTable search="" status="all" onMeta={vi.fn()} onSetStatus={onSetStatus} onDelete={onDelete} />
    )

    expect(await screen.findByText('mem@x.com')).toBeInTheDocument()
    expect(screen.getByText(/Negocio: own@x.com/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Suspender/i }))
    expect(onSetStatus).toHaveBeenCalledWith(member, 'suspended')

    await user.click(screen.getByRole('button', { name: /Eliminar/i }))
    expect(onDelete).toHaveBeenCalledWith(member)
  })

  it('muestra "Reactivar" para cuentas suspendidas', async () => {
    listTeamMembers.mockResolvedValue({ data: [{ ...member, account_status: 'suspended' }], count: 1 })
    renderWithClient(<TeamMembersAdminTable search="" status="all" onMeta={vi.fn()} onSetStatus={vi.fn()} onDelete={vi.fn()} />)
    expect(await screen.findByText('Suspendida')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Reactivar/i })).toBeInTheDocument()
  })
})
