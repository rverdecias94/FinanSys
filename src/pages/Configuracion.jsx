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
  const [balanceUsd, setBalanceUsd] = useState('')
  const [balanceCup, setBalanceCup] = useState('')
  const [savingBalance, setSavingBalance] = useState(false)
  const [loading, setLoading] = useState(true)

  const saveBalance = async () => {
    if (!session?.user?.id) return
    setSavingBalance(true)
    try {
      await updateBalanceConfig(session.user.id, balanceUsd, balanceCup)
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
          setBalanceUsd(balConfig.balance_total_usd || '')
          setBalanceCup(balConfig.balance_total_cup || '')
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
            <CardTitle>Balance Inicial</CardTitle>
            <CardDescription>Configura el balance total inicial por moneda</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Balance USD</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={balanceUsd}
                  onChange={(e) => setBalanceUsd(e.target.value)}
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label>Balance CUP</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={balanceCup}
                  onChange={(e) => setBalanceCup(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>
            <Button onClick={saveBalance} disabled={savingBalance}>
              {savingBalance ? 'Guardando...' : 'Guardar'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
