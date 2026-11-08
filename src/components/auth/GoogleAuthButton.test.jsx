import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const signInWithOAuth = vi.fn()
vi.mock('@/config/supabase', () => ({
  supabase: {
    auth: {
      signInWithOAuth: (...args) => signInWithOAuth(...args),
    },
  },
}))

vi.mock('@/hooks/useOnlineStatus', () => ({
  useOnlineStatus: () => true,
}))

const toastError = vi.fn()
vi.mock('sonner', () => ({
  toast: {
    error: (...a) => toastError(...a),
    info: vi.fn(),
  },
}))

import { GoogleAuthButton } from './GoogleAuthButton'

describe('GoogleAuthButton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    signInWithOAuth.mockResolvedValue({ data: { url: 'https://accounts.google.com' }, error: null })
  })

  it('llama signInWithOAuth con Google y redirect a /login', async () => {
    const user = userEvent.setup()
    render(<GoogleAuthButton mode="login" />)
    await user.click(screen.getByRole('button', { name: /Continuar con Google/i }))
    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: expect.objectContaining({
        redirectTo: expect.stringMatching(/\/login$/),
        queryParams: { prompt: 'select_account' },
      }),
    })
    expect(toastError).not.toHaveBeenCalled()
  })

  it('ya no muestra el mensaje de «disponible pronto»', () => {
    render(<GoogleAuthButton />)
    expect(screen.queryByText(/disponible pronto/i)).not.toBeInTheDocument()
  })
})
