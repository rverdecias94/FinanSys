import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

// Mock de recharts: evita dependencias de layout (ResizeObserver / dimensiones)
// en jsdom. El test solo verifica los KPIs numéricos de las tarjetas.
vi.mock('recharts', () => {
  const Stub = ({ children }) => <div>{children}</div>
  return {
    ResponsiveContainer: Stub, PieChart: Stub, Pie: Stub, Cell: Stub,
    Legend: Stub, Tooltip: Stub, LineChart: Stub, Line: Stub,
    XAxis: Stub, YAxis: Stub, CartesianGrid: Stub, BarChart: Stub, Bar: Stub
  }
})

import { AlmacenDashboard } from './AlmacenDashboard'

describe('AlmacenDashboard', () => {
  it('muestra 0 (no NaN ni vacío) cuando las métricas vienen undefined', () => {
    const stats = {
      totalProducts: undefined,
      lowStockCount: undefined,
      distribution: [],
      movementsTrend: [],
      topProducts: []
    }
    render(<AlmacenDashboard stats={stats} loading={false} />)

    expect(screen.getByText('Total Productos')).toBeInTheDocument()
    expect(screen.getByText('Bajo Stock')).toBeInTheDocument()

    // Ambas tarjetas de KPI deben mostrar "0"; nunca "NaN".
    const zeros = screen.getAllByText('0')
    expect(zeros.length).toBeGreaterThanOrEqual(2)
    expect(screen.queryByText('NaN')).toBeNull()
  })

  it('muestra los valores numéricos reales cuando existen', () => {
    const stats = {
      totalProducts: 12,
      lowStockCount: 3,
      distribution: [],
      movementsTrend: [],
      topProducts: []
    }
    render(<AlmacenDashboard stats={stats} loading={false} />)

    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('no renderiza nada hasta que stats está disponible', () => {
    const { container } = render(<AlmacenDashboard stats={null} loading={false} />)
    expect(container).toBeEmptyDOMElement()
  })
})
