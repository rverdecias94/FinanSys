import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { getBalanceConfig, updateBalanceConfig } from '@/services/finanzas'
import { useSession } from '@/hooks/useSession'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Settings } from 'lucide-react'

export default function Configuracion() {
  const { session } = useSession()
  const [initialBalanceUsd, setInitialBalanceUsd] = useState('')
  const [initialBalanceCup, setInitialBalanceCup] = useState('')
  const [currentBalanceUsd, setCurrentBalanceUsd] = useState('')
  const [currentBalanceCup, setCurrentBalanceCup] = useState('')
  const [savingBalance, setSavingBalance] = useState(false)
  const [loading, setLoading] = useState(true)

  const saveBalance = async () => {
    if (!session?.user?.id) return
    setSavingBalance(true)
    try {
      const updatedConfig = await updateBalanceConfig(session.user.id, initialBalanceUsd, initialBalanceCup)
      if (updatedConfig) {
        setInitialBalanceUsd(updatedConfig.initial_usd)
        setInitialBalanceCup(updatedConfig.initial_cup)
        setCurrentBalanceUsd(updatedConfig.total_usd)
        setCurrentBalanceCup(updatedConfig.total_cup)
      }
    } catch (error) {
      console.error(error)
    } finally {
      setSavingBalance(false)
    }
  }

  useEffect(() => {
    let mounted = true

    const loadData = async () => {
      if (session?.user?.id) {
        const balConfig = await getBalanceConfig(session.user.id)
        if (mounted && balConfig) {
          setInitialBalanceUsd(balConfig.initial_balance_usd || 0)
          setInitialBalanceCup(balConfig.initial_balance_cup || 0)
          setCurrentBalanceUsd(balConfig.balance_total_usd || 0)
          setCurrentBalanceCup(balConfig.balance_total_cup || 0)
        }
      }

      if (mounted) setLoading(false)
    }

    loadData()
    return () => { mounted = false }
  }, [session])

  return (
    <div className="space-y-8">
      <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-3">
        <div className="p-2 bg-primary/10 rounded-lg">
          <Settings className="w-8 h-8 text-primary" />
        </div>
        Configuración
      </h1>

      <div className="grid gap-6 md:grid-cols-1 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Balance</CardTitle>
            <CardDescription>Gestiona el balance inicial y visualiza el actual</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            
            {/* Balance Inicial (Editable) */}
            <div className="space-y-4 border-b pb-6">
              <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">Balance Inicial (Manual)</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Inicial USD</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={initialBalanceUsd}
                    onChange={(e) => setInitialBalanceUsd(e.target.value)}
                    disabled={loading || savingBalance}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Inicial CUP</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={initialBalanceCup}
                    onChange={(e) => setInitialBalanceCup(e.target.value)}
                    disabled={loading || savingBalance}
                  />
                </div>
              </div>
              <Button onClick={saveBalance} disabled={savingBalance}>
                {savingBalance ? 'Guardando...' : 'Actualizar Balance Inicial'}
              </Button>
            </div>

            {/* Balance Actual (Read-only) */}
            <div className="space-y-4">
              <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">Balance Actual (Calculado)</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Actual USD</Label>
                  <Input
                    type="number"
                    value={currentBalanceUsd}
                    disabled={true}
                    className="bg-muted"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Actual CUP</Label>
                  <Input
                    type="number"
                    value={currentBalanceCup}
                    disabled={true}
                    className="bg-muted"
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                El balance actual se calcula automáticamente: Balance Inicial + Ingresos - Gastos.
              </p>
            </div>

          </CardContent>
        </Card>
      </div>
    </div>
  )
}
