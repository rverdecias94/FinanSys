import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BalanceBaseSection } from './BalanceBaseSection'

const ACTIVE = ['CUP', 'USD']

describe('BalanceBaseSection', () => {
  it('renderiza solo las monedas activas que recibe', () => {
    const initialBalances = Object.fromEntries(ACTIVE.map((c) => [c, '']))
    const currentBalances = Object.fromEntries(ACTIVE.map((c) => [c, '0']))

    render(
      <BalanceBaseSection
        isOwner
        mainCurrency="USD"
        onChangeMainCurrency={vi.fn()}
        currencyCodes={ACTIVE}
        initialBalances={initialBalances}
        onChangeInitialBalance={vi.fn()}
        currentBalances={currentBalances}
        onSaveBaseCurrency={vi.fn()}
        onUpdateBalances={vi.fn()}
        isRefreshing={false}
      />
    )

    for (const code of ACTIVE) {
      expect(screen.getByText(`Inicial ${code}`)).toBeInTheDocument()
      expect(screen.getByText(`Actual ${code}`)).toBeInTheDocument()
    }
    expect(screen.getByText(ACTIVE.join(' / '))).toBeInTheDocument()
    expect(screen.queryByText('Inicial EUR')).toBeNull()
    expect(screen.queryByText('Inicial CAD')).toBeNull()
  })
})
