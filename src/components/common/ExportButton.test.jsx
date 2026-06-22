import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ExportButton } from './ExportButton'

describe('ExportButton', () => {
  it('muestra la etiqueta del formato por defecto', () => {
    render(<ExportButton format="excel" />)
    expect(screen.getByRole('button', { name: /Excel/i })).toBeInTheDocument()
  })

  it('usa la etiqueta personalizada', () => {
    render(<ExportButton format="word" label="Resumen General" />)
    expect(screen.getByText('Resumen General')).toBeInTheDocument()
  })

  it('ejecuta onClick al pulsar', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(<ExportButton format="pdf" onClick={onClick} />)
    await user.click(screen.getByRole('button', { name: /PDF/i }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('bloqueado: marca (Premium) y sigue siendo clickable para el upsell', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(<ExportButton format="excel" locked onClick={onClick} />)
    const btn = screen.getByRole('button', { name: /Excel \(Premium\)/i })
    expect(btn).toBeInTheDocument()
    await user.click(btn)
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
