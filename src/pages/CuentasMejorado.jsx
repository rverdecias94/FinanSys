import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient, onlineManager, useIsRestoring } from '@tanstack/react-query'
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
import { PendingSyncRow } from '@/components/common/PendingSyncRow'
import { useSession } from '@/hooks/useSession'
import { useBusiness } from '@/context/BusinessContext'
import { useCurrency } from '@/context/CurrencyContext'
import { usePermissionCheck } from '@/components/common/PermissionGuard'
import { listOpenAccounts, listAccountPayments, getAgingReport } from '@/services/finanzas'
import { AgingPanel } from '@/components/finanzas/AgingPanel'
import { notify, getSupabaseErrorMessage } from '@/services/notifications'
import { notifyOfflineQueued } from '@/services/notifyWrap'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { genClientUuid } from '@/offline/clientUuid'
import { isNetworkError } from '@/offline/isNetworkError'
import { markOffline } from '@/offline/networkGuard'
import { PAYMENT_CREATE_KEY } from '@/offline/mutationDefaults'
import {
  applyOptimisticPayment,
  findOpenAccountInCache,
  restoreOpenAccountRow,
} from '@/offline/optimisticPayments'
import { applyOptimisticAgingDelta } from '@/offline/optimisticTotals'
import { prefetchAccountsSnapshot } from '@/offline/prefetchReadSnapshots'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { CardsBodySkeleton } from '@/components/common/pageSkeletons'

function isOverdue(dueDate) {
  if (!dueDate) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return new Date(dueDate) < today
}

function AccountsList({ direction, userId, businessId, enabled, formatCurrency, onPay, online = true }) {
  const income = direction === 'receivable'
  return (
    <ResponsiveListing
      queryKey={['open-accounts', direction, businessId || userId]}
      queryFn={({ page, pageSize }) => listOpenAccounts({ direction, page, pageSize, userId, businessId })}
      enabled={enabled}
      getItemKey={(t) => t.id}
      loadingMessage="Cargando cuentas..."
      emptyMessage={online
        ? (income ? 'No tienes cuentas por cobrar pendientes.' : 'No tienes cuentas por pagar pendientes.')
        : 'Sin copia local de cuentas. Entra con conexión una vez para guardarla aquí.'}
      renderItem={(t) => {
        const total = Number(t.amount)
        const paid = Number(t.paid_amount || 0)
        const remaining = Math.max(0, total - paid)
        const overdue = isOverdue(t.due_date)
        return (
          <PendingSyncRow pending={Boolean(t._pending)}>
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
              <Button
                size="sm"
                variant="outline"
                className="shrink-0"
                disabled={Boolean(t._pending) || remaining <= 0}
                onClick={() => onPay({ ...t, remaining })}
              >
                <HandCoins className="mr-1.5 h-4 w-4" />
                {income ? 'Cobrar' : 'Pagar'}
              </Button>
            </div>
          </PendingSyncRow>
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
  const online = useOnlineStatus()
  const isRestoring = useIsRestoring()

  const [tab, setTab] = useState('receivable')
  const [payTarget, setPayTarget] = useState(null)
  const [payAmount, setPayAmount] = useState('')
  const requeueGuardRef = useRef(new Set())

  useEffect(() => {
    if (!online || !userId || !businessId || businessLoading || isRestoring) return undefined
    let cancelled = false
    queueMicrotask(() => {
      if (!cancelled) void prefetchAccountsSnapshot(qc, { userId, businessId })
    })
    return () => { cancelled = true }
  }, [online, userId, businessId, businessLoading, isRestoring, qc])

  // Historial de abonos de la cuenta abierta en el diálogo (libro account_payments).
  const { data: abonos = [] } = useQuery({
    queryKey: ['account-payments', payTarget?.id],
    queryFn: () => listAccountPayments(payTarget.id),
    enabled: !!payTarget?.id
  })

  const enabled = !!userId && !!businessId && !businessLoading && !permissionLoading

  // Contadores de ambos tabs al cargar (antes solo se actualizaba el tab activo
  // vía onMeta → "Por pagar (0)" aunque hubiera pendientes).
  const { data: receivableCount = 0 } = useQuery({
    queryKey: ['open-accounts-count', 'receivable', businessId || userId],
    queryFn: async () => {
      const res = await listOpenAccounts({ direction: 'receivable', page: 1, pageSize: 1, userId, businessId })
      return res.count || 0
    },
    enabled
  })
  const { data: payableCount = 0 } = useQuery({
    queryKey: ['open-accounts-count', 'payable', businessId || userId],
    queryFn: async () => {
      const res = await listOpenAccounts({ direction: 'payable', page: 1, pageSize: 1, userId, businessId })
      return res.count || 0
    },
    enabled
  })
  const counts = { receivable: receivableCount, payable: payableCount }

  // Antigüedad de saldos (Q10) del tab activo. `tab` ya vale 'receivable'/'payable',
  // que coincide con la `direction` que espera getAgingReport.
  const { data: aging = [], isLoading: agingLoading } = useQuery({
    queryKey: ['aging', tab, businessId || userId],
    queryFn: () => getAgingReport(tab),
    enabled
  })

  const paymentMutation = useMutation({
    mutationKey: PAYMENT_CREATE_KEY,
    onMutate: async (vars) => {
      const id = vars?.transactionId
      const previous = findOpenAccountInCache(qc, id)
      if (id != null && !requeueGuardRef.current.has(vars?.client_uuid)) {
        applyOptimisticPayment(qc, id, vars?.amount)
        if (previous) {
          const dir = previous.type === 'income' ? 'receivable' : 'payable'
          applyOptimisticAgingDelta(qc, dir, {
            currency: previous.currency,
            deltaRemaining: -Number(vars?.amount || 0),
          })
        }
      }
      setPayTarget(null)
      if (!onlineManager.isOnline()) notifyOfflineQueued('Abono')
      return { id, previous, clientUuid: vars?.client_uuid }
    },
    onSuccess: (data, vars, ctx) => {
      if (ctx?.clientUuid) requeueGuardRef.current.delete(ctx.clientUuid)
      qc.invalidateQueries({ queryKey: ['open-accounts'] })
      qc.invalidateQueries({ queryKey: ['open-accounts-count'] })
      qc.invalidateQueries({ queryKey: ['transactions'] })
      qc.invalidateQueries({ queryKey: ['filteredTotals'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      qc.invalidateQueries({ queryKey: ['account-payments'] })
      qc.invalidateQueries({ queryKey: ['aging'] })
      if (data?.idempotent) {
        notify.info('Este abono ya estaba registrado; no se duplicó.')
      } else if (onlineManager.isOnline()) {
        notify.success('Pago registrado correctamente')
      }
    },
    onError: (error, vars, ctx) => {
      const uuid = ctx?.clientUuid || vars?.client_uuid
      if (isNetworkError(error)) {
        markOffline()
        notifyOfflineQueued('Abono')
        if (uuid && !requeueGuardRef.current.has(uuid)) {
          requeueGuardRef.current.add(uuid)
          queueMicrotask(() => paymentMutation.mutate(vars))
        }
        return
      }
      if (uuid) requeueGuardRef.current.delete(uuid)
      restoreOpenAccountRow(qc, ctx?.id ?? vars?.transactionId, ctx?.previous)
      notify.error(getSupabaseErrorMessage(error))
    },
  })

  const openPay = (t) => {
    if (t?._pending) {
      notify.info('Hay un abono pendiente de sincronizar en esta cuenta. Espera a que se suba.')
      return
    }
    setPayTarget(t)
    setPayAmount(String(t.remaining ?? ''))
  }

  const confirmPay = () => {
    const amount = Number(payAmount)
    if (!Number.isFinite(amount) || amount <= 0) {
      notify.error('Ingresa un monto válido mayor que cero')
      return
    }
    if (payTarget?.remaining != null && amount > Number(payTarget.remaining) + 0.005) {
      notify.error('El abono excede el saldo pendiente')
      return
    }
    paymentMutation.mutate({
      transactionId: payTarget.id,
      amount,
      userId,
      businessId,
      client_uuid: genClientUuid(),
    })
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
              {isRestoring ? (
                <CardsBodySkeleton cards={2} />
              ) : (
                <AgingPanel
                  rows={aging}
                  loading={agingLoading}
                  formatCurrency={formatCurrency}
                  income={isIncome}
                  emptyMessage={online
                    ? (isIncome ? 'No hay cuentas por cobrar pendientes.' : 'No hay cuentas por pagar pendientes.')
                    : 'Sin copia local de antigüedad. Entra con conexión una vez para guardarla.'}
                />
              )}
            </div>

            <TabsContent value="receivable" className="mt-4">
              {isRestoring ? <CardsBodySkeleton cards={3} /> : (
                <AccountsList
                  direction="receivable"
                  userId={userId}
                  businessId={businessId}
                  enabled={enabled && isIncome}
                  formatCurrency={formatCurrency}
                  onPay={openPay}
                  online={online}
                />
              )}
            </TabsContent>

            <TabsContent value="payable" className="mt-4">
              {isRestoring ? <CardsBodySkeleton cards={3} /> : (
                <AccountsList
                  direction="payable"
                  userId={userId}
                  businessId={businessId}
                  enabled={enabled && !isIncome}
                  formatCurrency={formatCurrency}
                  onPay={openPay}
                  online={online}
                />
              )}
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
            <Button onClick={confirmPay} loading={false}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
