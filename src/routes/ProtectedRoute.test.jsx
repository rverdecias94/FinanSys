import { describe, it, expect, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { render, screen } from '@testing-library/react'
import ProtectedRoute from './ProtectedRoute'

vi.mock('@/hooks/useSession', () => ({
  useSession: () => ({ session: { user: { id: 'u1' } }, loading: false })
}))

vi.mock('@/context/PermissionContext', () => ({
  usePermissions: () => ({ hasPermission: () => true, loading: false, isOwner: true })
}))

vi.mock('@/context/BusinessContext', () => ({
  useBusiness: () => ({ loading: false })
}))

vi.mock('@/services/planRequests', () => ({
  isSystemAdmin: vi.fn().mockResolvedValue(false)
}))

function wrap(ui, initialEntries) {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false }
    }
  })

  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>
    </QueryClientProvider>
  )
}

describe('ProtectedRoute systemAdminOnly', () => {
  it('redirects to / when not system admin', async () => {
    wrap(
      <Routes>
        <Route path="/" element={<div>HOME</div>} />
        <Route element={<ProtectedRoute systemAdminOnly />}>
          <Route path="/admin/planes" element={<div>ADMIN</div>} />
        </Route>
      </Routes>,
      ['/admin/planes']
    )

    expect(await screen.findByText('HOME')).toBeInTheDocument()
  })
})

