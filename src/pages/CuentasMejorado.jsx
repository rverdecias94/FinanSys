import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Wallet, TrendingUp, TrendingDown, CalendarClock, AlertTriangle, HandCoins, Layers } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog'
import { ResponsiveListing } from '@/components/common/ResponsiveListing'
import { useSession } from '@/hooks/useSession'
import { useBusiness } from '@/context/BusinessContext'
import { useCurrency } from '@/context/CurrencyContext'
import { usePermissionCheck } from '@/components/common/PermissionGuard'
import { listOpenAccounts, registerPayment, listAccountPayments, getAgingReport } from '@/services/finanzas'
import { AgingPanel } from '@/components/finanzas/AgingPanel'
import { notify, getSupabaseErrorMessage } from '@/services/notifications'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

function isOverdue(dueDate) {
  if (!dueDate) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return new Date(dueDate) < today
}

function AccountsList({ direction, userId, businessId, enabled, formatCurrency, onPay, onMeta }) {
  const income = direction === 'receivable'
  return (
    <ResponsiveListing
      queryKey={['open-accounts', direction, businessId || userId]}
      queryFn={({ page, pageSize }) => listOpenAccounts({ direction, page, pageSize, userId, businessId })}
      enabled={enabled}
      onMeta={onMeta}
      getItemKey={(t) => t.id}
      loadingMessage="Cargando cuentas..."
      emptyMessage={income ? 'No tienes cuentas por cobrar pendientes.' : 'No tienes cuentas por pagar pendientes.'}
      renderItem={(t) => {
        const total = Number(t.amount)
        const paid = Number(t.paid_amount || 0)
        const remaining = Math.max(0, total - paid)
        const overdue = isOverdue(t.due_date)
        return (
          <div className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div className="flex min-w-0 items-start gap-3 sm:items-center">
              <div className={`shrink-0 rounded-full p-2 ${income ? 'bg-success/10' : 'bg-destructive/10'}`}>
                {income ? <TrendingUp className="h-4 w-4 text-success" /> : <TrendingDown className="h-4 w-4 text-destructive" />}
              </div>
              <div className="min-w-0">
                <div className="font-medium break-words">{t.contact?.name || t.description || 'Sin contacto'}</div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-muted-foreground">
                  {t.contact?.name && t.description && <span className="truncate">{t.description}</span>}
                  {t.due_date && (
                    <span className={`flex items-center gap-1 ${overdue ? 'text-destructive font-medium' : ''}`}>
                      {overdue ? <AlertTriangle className="h-3 w-3" /> : <CalendarClock className="h-3 w-3" />}
                      Vence {format(new Date(t.due_date), 'PP', { locale: es })}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 border-t pt-3 sm:shrink-0 sm:justify-end sm:gap-4 sm:border-0 sm:pt-0">
              <div className="flex min-w-0 flex-col items-start gap-1 sm:items-end">
                <div className={`whitespace-nowrap font-semibold ${income ? 'text-success' : 'text-destructive'}`}>
                  {formatCurrency(remaining, t.currency)}
                </div>
                <div className="flex items-center gap-2">
                  {paid > 0 && <Badge variant="outline" className="text-[10px]">Abonado {formatCurrency(paid, t.currency)}</Badge>}
                  {overdue && <Badge variant="destructive" className="text-[10px]">Vencida</Badge>}
                </div>
              </div>
              <Button size="sm" variant="outline" className="shrink-0" onClick={() => onPay({ ...t, remaining })}>
                <HandCoins className="mr-1.5 h-4 w-4" />
                {income ? 'Cobrar' : 'Pagar'}
              </Button>
            </div>
          </div>
        )
      }}
    />
  )
}

export default function CuentasMejorado() {
  const { session } = useSession()
  const { businessId, loading: businessLoading } = useBusiness()
  const { formatCurrency } = useCurrency()
  const { canView, loading: permissionLoading } = usePermissionCheck()
  const qc = useQueryClient()
  const userId = session?.user?.id

  const [tab, setTab] = useState('receivable')
  const [counts, setCounts] = useState({ receivable: 0, payable: 0 })
  const [payTarget, setPayTarget] = useState(null)
  const [payAmount, setPayAmount] = useState('')

  // Historial de abonos de la cuenta abierta en el diálogo (libro account_payments).
  const { data: abonos = [] } = useQuery({
    queryKey: ['account-payments', payTarget?.id],
    queryFn: () => listAccountPayments(payTarget.id),
    enabled: !!payTarget?.id
  })

  const enabled = !!userId && !!businessId && !businessLoading && !permissionLoading

  // Antigüedad de saldos (Q10) del tab activo. `tab` ya vale 'receivable'/'payable',
  // que coincide con la `direction` que espera getAgingReport.
  const { data: aging = [], isLoading: agingLoading } = useQuery({
    queryKey: ['aging', tab, businessId || userId],
    queryFn: () => getAgingReport(tab),
    enabled
  })

  const paymentMutation = useMutation({
    mutationFn: ({ id, amount }) => registerPayment(id, amount, userId, businessId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['open-accounts'] })
      qc.invalidateQueries({ queryKey: ['transactions'] })
      qc.invalidateQueries({ queryKey: ['filteredTotals'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      qc.invalidateQueries({ queryKey: ['account-payments'] })
      qc.invalidateQueries({ queryKey: ['aging'] })
      notify.success('Pago registrado correctamente')
      setPayTarget(null)
    },
    onError: (e) => notify.error(getSupabaseErrorMessage(e))
  })

  const openPay = (t) => {
    setPayTarget(t)
    setPayAmount(String(t.remaining ?? ''))
  }

  const confirmPay = () => {
    const amount = Number(payAmount)
    if (!Number.isFinite(amount) || amount <= 0) {
      notify.error('Ingresa un monto válido mayor que cero')
      return
    }
    paymentMutation.mutate({ id: payTarget.id, amount })
  }

  if (!permissionLoading && !canView('finanzas')) {
    return (
      <div className="flex items-center justify-center h-96">
        <Card className="p-6 text-center">
          <CardContent>
            <Wallet className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Acceso Restringido</h3>
            <p className="text-muted-foreground">No tienes permisos para acceder a Cuentas.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const isIncome = tab === 'receivable'

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <HandCoins className="w-8 h-8 text-primary" />
          </div>
          Por cobrar / Por pagar
        </h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Cuentas pendientes</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="grid w-full grid-cols-2 sm:w-auto sm:inline-flex">
              <TabsTrigger value="receivable">Por cobrar ({counts.receivable})</TabsTrigger>
              <TabsTrigger value="payable">Por pagar ({counts.payable})</TabsTrigger>
            </TabsList>

            {/* Antigüedad de saldos (Q10): foto a hoy del tab activo, por moneda y tramo. */}
            <div className="mt-4 rounded-lg border bg-muted/20 p-3 sm:p-4">
              <div className="mb-3 flex items-center gap-2">
                <Layers className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold">Antigüedad de saldos</span>
              </div>
              <AgingPanel
                rows={aging}
                loading={agingLoading}
                formatCurrency={formatCurrency}
                income={isIncome}
                emptyMessage={isIncome ? 'No hay cuentas por cobrar pendientes.' : 'No hay cuentas por pagar pendientes.'}
              />
            </div>

            <TabsContent value="receivable" className="mt-4">
              <AccountsList
                direction="receivable"
                userId={userId}
                businessId={businessId}
                enabled={enabled && isIncome}
                formatCurrency={formatCurrency}
                onPay={openPay}
                onMeta={({ count }) => setCounts((c) => ({ ...c, receivable: count }))}
              />
            </TabsContent>

            <TabsContent value="payable" className="mt-4">
              <AccountsList
                direction="payable"
                userId={userId}
                businessId={businessId}
                enabled={enabled && !isIncome}
                formatCurrency={formatCurrency}
                onPay={openPay}
                onMeta={({ count }) => setCounts((c) => ({ ...c, payable: count }))}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Dialog open={!!payTarget} onOpenChange={(o) => { if (!o) setPayTarget(null) }}>
        <DialogContent className="max-w-[420px]">
          <DialogHeader>
            <DialogTitle>{isIncome ? 'Registrar cobro' : 'Registrar pago'}</DialogTitle>
            <DialogDescription>
              {payTarget?.contact?.name || payTarget?.description}
              {payTarget ? ` · Saldo: ${formatCurrency(payTarget.remaining, payTarget.currency)}` : ''}
            </DialogDescription>
          </DialogHeader>
          {abonos.length > 0 && (
            <div className="rounded-md border bg-muted/20 p-3">
              <div className="mb-1.5 text-xs font-medium text-muted-foreground">Abonos registrados</div>
              <ul className="space-y-1">
                {abonos.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate text-muted-foreground">
                      {format(new Date(a.paid_at), 'PP', { locale: es })}{a.method ? ` · ${a.method}` : ''}
                    </span>
                    <span className="shrink-0 font-medium">{formatCurrency(a.amount, payTarget?.currency)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="grid gap-1.5">
            <Label htmlFor="pay-amount">Monto</Label>
            <Input
              id="pay-amount"
              type="number"
              min="0"
              step="0.01"
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
              placeholder="0.00"
            />
            <p className="text-xs text-muted-foreground">Puedes registrar un abono parcial o el saldo completo.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayTarget(null)}>Cancelar</Button>
            <Button onClick={confirmPay} loading={paymentMutation.isPending}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
