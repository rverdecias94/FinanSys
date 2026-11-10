import { Coins } from 'lucide-react'
import { CurrenciesPanel } from '@/components/config/CurrenciesPanel'
import { BalanceBasePanel } from '@/components/config/BalanceBasePanel'
import { CuentaPageShell } from '@/pages/cuenta/CuentaPageShell'

export default function MonedasPage() {
  return (
    <CuentaPageShell title="Monedas" icon={Coins}>
      <div className="space-y-6">
        <CurrenciesPanel />
        <BalanceBasePanel />
      </div>
    </CuentaPageShell>
  )
}
