import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Verifica el flujo de reenvío de confirmación SIN tocar Supabase real:
// se mockea el cliente de auth y se comprueba el comportamiento de la UI.

const signInWithPassword = vi.fn()
const resend = vi.fn()
vi.mock('@/config/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: (...args) => signInWithPassword(...args),
      resend: (...args) => resend(...args),
    },
  },
}))

vi.mock('@/services/team', () => ({
  acceptPendingInvitations: vi.fn().mockResolvedValue(undefined),
  getBusinessContext: vi.fn().mockResolvedValue({ isOwner: true }),
}))

const navigate = vi.fn()
vi.mock('react-router-dom', () => ({
  useNavigate: () => navigate,
  useLocation: () => ({ state: null, pathname: '/login' }),
  Link: ({ children, to }) => <a href={to}>{children}</a>,
}))

const toastSuccess = vi.fn()
const toastError = vi.fn()
const toastInfo = vi.fn()
vi.mock('sonner', () => ({
  toast: {
    success: (...a) => toastSuccess(...a),
    error: (...a) => toastError(...a),
    info: (...a) => toastInfo(...a),
  },
}))

import Login from './Login'

const submitLogin = async (user) => {
  await user.type(screen.getByLabelText('Correo Electrónico'), 'usuario@ejemplo.com')
  await user.type(screen.getByLabelText('Contraseña'), 'ClaveSegura123')
  await user.click(screen.getByRole('button', { name: 'Iniciar Sesión' }))
}

describe('Login · reenviar confirmación', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('con credenciales incorrectas NO ofrece reenviar y muestra el error en español', async () => {
    const user = userEvent.setup()
    signInWithPassword.mockResolvedValue({
      data: null,
      error: { code: 'invalid_credentials', message: 'Invalid login credentials' },
    })
    render(<Login />)
    await submitLogin(user)

    expect(await screen.findByText(/incorrectos/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Reenviar correo de confirmación/i })).toBeNull()
  })

  it('con el correo sin confirmar muestra el botón y reenvía la confirmación', async () => {
    const user = userEvent.setup()
    signInWithPassword.mockResolvedValue({
      data: null,
      error: { code: 'email_not_confirmed', message: 'Email not confirmed' },
    })
    resend.mockResolvedValue({ error: null })
    render(<Login />)
    await submitLogin(user)

    const boton = await screen.findByRole('button', { name: /Reenviar correo de confirmación/i })
    expect(boton).toBeInTheDocument()

    await user.click(boton)
    await waitFor(() =>
      expect(resend).toHaveBeenCalledWith({ type: 'signup', email: 'usuario@ejemplo.com' })
    )
    expect(toastSuccess).toHaveBeenCalled()
  })

  it('tras reenviar, activa la cuenta atrás y deshabilita el botón', async () => {
    const user = userEvent.setup()
    signInWithPassword.mockResolvedValue({
      data: null,
      error: { code: 'email_not_confirmed', message: 'Email not confirmed' },
    })
    resend.mockResolvedValue({ error: null })
    render(<Login />)
    await submitLogin(user)

    await user.click(await screen.findByRole('button', { name: /Reenviar correo de confirmación/i }))

    const enEspera = await screen.findByRole('button', { name: /Podrás reenviar en/i })
    expect(enEspera).toBeDisabled()
  })

  it('si el reenvío falla, muestra un toast de error (sin activar la cuenta atrás)', async () => {
    const user = userEvent.setup()
    signInWithPassword.mockResolvedValue({
      data: null,
      error: { code: 'email_not_confirmed', message: 'Email not confirmed' },
    })
    resend.mockResolvedValue({
      error: { code: 'over_email_send_rate_limit', message: 'Email rate limit exceeded' },
    })
    render(<Login />)
    await submitLogin(user)

    await user.click(await screen.findByRole('button', { name: /Reenviar correo de confirmación/i }))

    await waitFor(() => expect(toastError).toHaveBeenCalled())
    // El botón sigue disponible para reintentar (no entró en cuenta atrás).
    expect(screen.getByRole('button', { name: /Reenviar correo de confirmación/i })).toBeEnabled()
  })
})
