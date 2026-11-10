import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@/context/BusinessContext', () => ({
  useBusiness: () => ({ isOwner: true }),
}))

vi.mock('react-router-dom', () => ({
  Navigate: ({ to }) => <div data-testid="nav" data-to={to} />,
}))

import ConfiguracionMejorado from './ConfiguracionMejorado'

describe('ConfiguracionMejorado · redirect', () => {
  it('owner redirige a /cuenta/plan', () => {
    render(<ConfiguracionMejorado />)
    expect(screen.getByTestId('nav').dataset.to).toBe('/cuenta/plan')
  })
})
