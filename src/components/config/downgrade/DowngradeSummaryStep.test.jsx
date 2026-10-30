import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DowngradeSummaryStep } from './DowngradeSummaryStep'

describe('DowngradeSummaryStep', () => {
  it('lista impactos claros al bajar desde Élite', () => {
    render(
      <DowngradeSummaryStep
        currentPlan="ultra"
        preview={{
          current_plan: 'ultra',
          free_limits: { areas: 1, monthly_transactions: 150, products: 50, currencies: 1, partners: 0 },
          usage: {
            active_currencies: 2,
            partners: 3,
            areas: 5,
            products: 60,
            monthly_transactions: 10,
          },
          features_lost: ['ai_tools', 'audit_logs'],
        }}
        activeCurrencies={[{}, {}]}
        sortedAreas={[{}, {}, {}, {}, {}]}
        areasLimit={1}
        monthlyTxLimit={150}
        productsLimit={50}
      />
    )

    expect(screen.getByText(/Pasarás de/i)).toBeInTheDocument()
    expect(screen.getByText(/Élite/)).toBeInTheDocument()
    expect(screen.getByText(/Plan Inicial/)).toBeInTheDocument()
    expect(screen.getByText(/3 miembros/i)).toBeInTheDocument()
    expect(screen.getByText(/solo lectura/i)).toBeInTheDocument()
    expect(screen.getAllByText(/Copiloto IA/i).length).toBeGreaterThan(0)
  })
})
