import { useMemo, useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient, onlineManager } from '@tanstack/react-query'
import { listTransactions, getFinanceCategories, getPaymentMethods, getFilteredTotals, exportTransactions } from '@/services/finanzas'
import { listProductsForSelection } from '@/services/almacen'
import { listContacts } from '@/services/contacts'
import { Button } from '@/components/ui/button'
import { Wallet, Plus, TrendingUp, TrendingDown, Pencil, Eye } from 'lucide-react'
import { PendingSyncRow } from '@/components/common/PendingSyncRow'
import { useSession } from '@/hooks/useSession'
import { useBusiness } from '@/context/BusinessContext'
import { useSubscription } from '@/context/SubscriptionContext'
import { useCurrency } from '@/context/CurrencyContext'
import { PermissionGuard, usePermissionCheck, ActionButtons } from '@/components/common/PermissionGuard'
import { TransactionModal } from '@/components/finanzas/TransactionModal'
import { RecurringPanel } from '@/components/finanzas/RecurringPanel'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Badge } from '@/components/ui/badge'
import DateRangeFilter from '@/components/common/DateRangeFilter'
import { ResponsiveListing } from '@/components/common/ResponsiveListing'
import { PlanLimitFeedback } from '@/components/common/PlanLimitFeedback'
import { ExportButton } from '@/components/common/ExportButton'
import { notify, getSupabaseErrorMessage } from '@/services/notifications'
import { notifyOfflineQueued } from '@/services/notifyWrap'
import { TX_CREATE_KEY, TX_UPDATE_KEY } from '@/offline/mutationDefaults'
import { serializeTransactionPayload } from '@/offline/serializeMutation'
import {
  applyOptimisticCreate,
  buildPendingTransactionRow,
  clearOptimisticPending,
} from '@/offline/optimisticTransactions'
import { countQueuedMutations } from '@/offline/syncEngine'
import { isNetworkError } from '@/offline/isNetworkError'
import { markOffline } from '@/offline/networkGuard'

export default function FinanzasMejorado() {
  const { session } = useSession()
  const { businessId, loading: businessLoading } = useBusiness()
  const { checkLimit, recordUsage, getRemainingUsage } = useSubscription()
  const { businessCurrencies, formatCurrency } = useCurrency()
  const { canView, canEdit, canCreate, canExport, loading: permissionLoading } = usePermissionCheck()
  const queryClient = useQueryClient()

  // Estado local
  const [txCount, setTxCount] = useState(0)
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedTransaction, setSelectedTransaction] = useState(null)
  const [currencyFilter, setCurrencyFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState(null)
  const [isExporting, setIsExporting] = useState(false)

  const userId = session?.user?.id
  const dateKey = dateFilter ? JSON.stringify(dateFilter) : null

  const handleDateSelect = (filter) => {
    setDateFilter(filter)
  }

  // Queries
  const { data: categories } = useQuery({
    queryKey: ['financeCategories', businessId || userId],
    queryFn: () => getFinanceCategories(),
    enabled: !!userId && !!businessId && !businessLoading,
  })

  const { data: paymentMethods } = useQuery({
    queryKey: ['paymentMethods', businessId || userId],
    queryFn: () => getPaymentMethods(),
    enabled: !!userId && !!businessId && !businessLoading,
  })

  // Contactos para el selector del modal (clientes/proveedores).
  const { data: contactsData } = useQuery({
    queryKey: ['contacts', 'select', businessId || userId],
    queryFn: () => listContacts({ userId, businessId, pageSize: 1000 }),
    enabled: !!userId && !!businessId && !businessLoading,
  })

  // Productos para el modo "venta de producto" del modal (S7). Comparte caché con
  // Almacén (mismo queryKey) y se refresca al invalidar ['warehouse'] tras una venta.
  const { data: productsData } = useQuery({
    queryKey: ['warehouse', 'productsSelection', businessId || userId],
    queryFn: () => listProductsForSelection({ userId, businessId }),
    enabled: !!userId && !!businessId && !businessLoading,
  })

  const { data: filteredTotals, isLoading: totalsLoading } = useQuery({
    queryKey: ['filteredTotals', { userId: businessId || userId, currency: currencyFilter, category: categoryFilter, dateKey }],
    queryFn: () => getFilteredTotals({
      userId,
      businessId,
      currency: currencyFilter !== 'all' ? currencyFilter : undefined,
      category: categoryFilter !== 'all' ? categoryFilter : undefined,
      from: dateFilter?.startDate || undefined,
      to: dateFilter?.endDate || undefined,
    }),
    enabled: !!userId && !!businessId && !businessLoading && !permissionLoading,
  })

  // Evita reencolar en bucle si un reintento offline vuelve a fallar al instante.
  const requeueGuardRef = useRef(new Set())

  // Mutaciones (outbox C1): mutationFn vive en mutationDefaults; aquí solo
  // variables serializables + UI optimista / toasts offline.
  const createMutation = useMutation({
    mutationKey: TX_CREATE_KEY,
    onMutate: async (vars) => {
      const payload = vars?.payload || {}
      const clientUuid = payload.client_uuid
      // Si es reencolado tras fallo de red, la fila optimista ya está.
      if (!requeueGuardRef.current.has(clientUuid)) {
        const row = buildPendingTransactionRow(payload, { userId, businessId })
        applyOptimisticCreate(queryClient, row)
      }
      const offline = !onlineManager.isOnline()
      // Cerrar YA: no dejar el modal en loading mientras el DNS hace timeout.
      setModalOpen(false)
      setSelectedTransaction(null)
      if (offline) notifyOfflineQueued('Transacción')
      return { clientUuid, offline }
    },
    onSuccess: (data, vars, ctx) => {
      const uuid = ctx?.clientUuid || vars?.payload?.client_uuid
      if (uuid) requeueGuardRef.current.delete(uuid)
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['filteredTotals'] })
      queryClient.invalidateQueries({ queryKey: ['warehouse'] })
      queryClient.invalidateQueries({ queryKey: ['aging'] })
      queryClient.invalidateQueries({ queryKey: ['open-accounts'] })
      queryClient.invalidateQueries({ queryKey: ['open-accounts-count'] })
      queryClient.invalidateQueries({ queryKey: ['balanceConfig'] })
      // Reintento idempotente: ya existía → avisar y NO contar uso otra vez.
      if (data?.idempotent) {
        notify.info(vars?.payload?.isSale
          ? 'Esta venta ya estaba registrada; no se duplicó.'
          : 'Esta transacción ya estaba registrada; no se duplicó.')
      } else if (!ctx?.offline) {
        recordUsage('monthly_transactions')
      }
    },
    onError: (error, vars, ctx) => {
      const uuid = ctx?.clientUuid || vars?.payload?.client_uuid
      // Windows a veces dice "online" sin Internet → el fetch falla.
      // Marcamos offline, conservamos la fila y reencolamos (queda paused).
      if (isNetworkError(error)) {
        markOffline()
        notifyOfflineQueued('Transacción')
        if (uuid && !requeueGuardRef.current.has(uuid)) {
          requeueGuardRef.current.add(uuid)
          queueMicrotask(() => createMutation.mutate(vars))
        }
        return
      }
      if (uuid) requeueGuardRef.current.delete(uuid)
      clearOptimisticPending(queryClient, uuid)
      notify.error(getSupabaseErrorMessage(error))
    },
  })

  const updateMutation = useMutation({
    mutationKey: TX_UPDATE_KEY,
    onMutate: async (vars) => {
      const offline = !onlineManager.isOnline()
      setModalOpen(false)
      setSelectedTransaction(null)
      if (offline) notifyOfflineQueued('Transacción')
      return { offline, id: vars?.id }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['filteredTotals'] })
      queryClient.invalidateQueries({ queryKey: ['aging'] })
      queryClient.invalidateQueries({ queryKey: ['open-accounts'] })
      queryClient.invalidateQueries({ queryKey: ['open-accounts-count'] })
      queryClient.invalidateQueries({ queryKey: ['balanceConfig'] })
    },
    onError: (error, vars) => {
      if (isNetworkError(error)) {
        markOffline()
        notifyOfflineQueued('Transacción')
        const key = `upd-${vars?.id}`
        if (!requeueGuardRef.current.has(key)) {
          requeueGuardRef.current.add(key)
          queueMicrotask(() => updateMutation.mutate(vars))
        }
        return
      }
      notify.error(getSupabaseErrorMessage(error))
    },
  })

  const handleTransactionSubmit = (rawPayload) => {
    const payload = serializeTransactionPayload(rawPayload)
    if (selectedTransaction?.id && !String(selectedTransaction.id).startsWith('pending-')) {
      updateMutation.mutate({ id: selectedTransaction.id, payload, userId, businessId })
      return
    }
    createMutation.mutate({ payload, userId, businessId })
  }

  // Handlers
  const handleCreate = () => {
    // Cupo local: contar también creates ya en cola offline (decisión Capa C #2).
    const queuedCreates = countQueuedMutations(queryClient, TX_CREATE_KEY)
    const remaining = getRemainingUsage('monthly_transactions')
    if (remaining !== Infinity && remaining - queuedCreates <= 0) {
      if (!onlineManager.isOnline()) {
        notify.error('Sin conexión no puedes superar el límite de tu plan.')
      } else if (!checkLimit('monthly_transactions')) {
        return
      } else {
        notify.error('Límite del plan alcanzado')
      }
      return
    }
    if (!checkLimit('monthly_transactions')) return
    setSelectedTransaction(null)
    setModalOpen(true)
  }

  const handleEdit = (transaction) => {
    if (transaction?._pending) {
      notify.info('Esta operación aún no se ha subido. Espera a que se sincronice para editarla.')
      return
    }
    // Una venta de producto (S7) está ligada a Almacén (sale_items + COGS sellado):
    // editar el monto aquí desincronizaría el margen, así que se abre en solo lectura.
    if (transaction?.details?.sale) {
      notify.info('Esta venta está ligada a Almacén; se abre en modo lectura. Para corregirla, registra un ajuste de inventario o una nueva operación.')
      setSelectedTransaction({ ...transaction, readonly: true })
      setModalOpen(true)
      return
    }
    setSelectedTransaction(transaction)
    setModalOpen(true)
  }

  const handleView = (transaction) => {
    setSelectedTransaction({ ...transaction, readonly: true })
    setModalOpen(true)
  }

  const handleExport = async () => {
    if (!canExport('finanzas')) {
      notify.error('No tienes permisos para exportar finanzas')
      return
    }

    setIsExporting(true)
    try {
      const result = await exportTransactions({
        userId,
        businessId,
        currency: currencyFilter !== 'all' ? currencyFilter : undefined,
        category: categoryFilter !== 'all' ? categoryFilter : undefined,
        from: dateFilter?.startDate || undefined,
        to: dateFilter?.endDate || undefined,
        format: 'xlsx'
      })

      if (!result?.count) {
        notify.error('No hay datos para exportar con los filtros actuales')
        return
      }

      notify.success(`Exportación completada (${result.count} registros)`)
    } catch (error) {
      notify.error('Error al exportar datos')
    } finally {
      setIsExporting(false)
    }
  }

  const summaryCurrencies = useMemo(() => {
    const incomeCurrencies = Object.keys(filteredTotals?.income || {})
    const expenseCurrencies = Object.keys(filteredTotals?.expense || {})
    const currenciesFromTotals = [...new Set([...incomeCurrencies, ...expenseCurrencies])]

    if (currencyFilter !== 'all') return [currencyFilter]
    if (currenciesFromTotals.length > 0) return currenciesFromTotals

    return businessCurrencies?.map(currency => currency.code) || []
  }, [businessCurrencies, currencyFilter, filteredTotals])

  const financeSummary = useMemo(() => (
    summaryCurrencies.map(code => {
      const income = Number(filteredTotals?.income?.[code] || 0)
      const expense = Number(filteredTotals?.expense?.[code] || 0)

      return {
        code,
        income,
        expense,
        net: income - expense
      }
    })
  ), [filteredTotals, summaryCurrencies])

  const categoryOptions = useMemo(() => {
    if (!categories) return []
    const income = Array.isArray(categories.income) ? categories.income : []
    const expense = Array.isArray(categories.expense) ? categories.expense : []
    return Array.from(new Set([...income, ...expense].filter(Boolean))).sort((a, b) => a.localeCompare(b, 'es'))
  }, [categories])

  // Si no tiene permisos de visualización, mostrar mensaje
  if (!canView('finanzas')) {
    return (
      <div className="flex items-center justify-center h-96">
        <Card className="p-6 text-center">
          <CardContent>
            <Wallet className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Acceso Restringido</h3>
            <p className="text-muted-foreground">
              No tienes permisos para acceder al módulo de Finanzas.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Wallet className="w-8 h-8 text-primary" />
          </div>
          <div>
            Finanzas
            <PlanLimitFeedback metric="monthly_transactions" label="Transacciones" className="mt-1" />
          </div>
        </h1>

        <div className="flex gap-2">
          <PermissionGuard permission="finanzas.export">
            <ExportButton format="excel" label="Exportar" size="default" loading={isExporting} onClick={handleExport} />
          </PermissionGuard>

          <PermissionGuard permission="finanzas.create">
            <Button onClick={handleCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Nueva Transacción
            </Button>
          </PermissionGuard>
        </div>
      </div>

      {/* Filtros: un único panel alineado (fecha + moneda + categoría) que afecta
          tanto a las tarjetas de totales como a la lista de transacciones. */}
      <DateRangeFilter onFilterChange={handleDateSelect} className="sm:w-full">
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:gap-4 sm:items-end">
          <div className="w-full space-y-2 sm:w-auto">
            <Label>Moneda</Label>
            <Select value={currencyFilter} onValueChange={setCurrencyFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Todas las monedas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las monedas</SelectItem>
                {businessCurrencies?.map(currency => (
                  <SelectItem key={currency.code} value={currency.code}>
                    {currency.name} ({currency.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="w-full space-y-2 sm:w-auto">
            <Label>Categoría</Label>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Todas las categorías" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las categorías</SelectItem>
                {categoryOptions.map(categoryName => (
                  <SelectItem key={categoryName} value={categoryName}>
                    {categoryName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </DateRangeFilter>

      {/* Resumen de totales */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Ingresos</CardTitle>
            <TrendingUp className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            {totalsLoading ? (
              <Skeleton className="h-8 w-28" />
            ) : (
              <div className="space-y-1">
                {financeSummary.map(item => (
                  <div key={item.code} className={`font-bold text-success break-words tabular-nums ${financeSummary.length > 1 ? 'text-lg' : 'text-2xl'}`}>
                    + {formatCurrency(item.income, item.code)}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Gastos</CardTitle>
            <TrendingDown className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            {totalsLoading ? (
              <Skeleton className="h-8 w-28" />
            ) : (
              <div className="space-y-1">
                {financeSummary.map(item => (
                  <div key={item.code} className={`font-bold text-destructive break-words tabular-nums ${financeSummary.length > 1 ? 'text-lg' : 'text-2xl'}`}>
                    − {formatCurrency(item.expense, item.code)}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Balance Neto</CardTitle>
            <Wallet className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            {totalsLoading ? (
              <Skeleton className="h-8 w-28" />
            ) : (
              <div className="space-y-1">
                {financeSummary.map(item => (
                  <div
                    key={item.code}
                    className={`font-bold break-words tabular-nums ${item.net >= 0 ? 'text-success' : 'text-destructive'} ${financeSummary.length > 1 ? 'text-lg' : 'text-2xl'}`}
                  >
                    {formatCurrency(item.net, item.code)}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Transacciones</CardTitle>
            <div className="flex h-4 w-4 items-center justify-center font-bold text-muted-foreground">#</div>
          </CardHeader>
          <CardContent>
            {totalsLoading && txCount === 0 ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold text-foreground">
                {txCount}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <RecurringPanel
        userId={userId}
        businessId={businessId}
        businessLoading={businessLoading}
        categories={categories}
        paymentMethods={paymentMethods}
        currencies={businessCurrencies}
        contacts={contactsData?.data || []}
        formatCurrency={formatCurrency}
        canCreate={canCreate('finanzas')}
      />

      {/* Tabla de transacciones */}
      <Card>
        <CardHeader>
          <CardTitle>Transacciones</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveListing
            queryKey={['transactions', { userId, businessId, currencyFilter, categoryFilter, dateKey }]}
            queryFn={({ page, pageSize }) => listTransactions({
              userId,
              businessId,
              page,
              pageSize,
              currency: currencyFilter !== 'all' ? currencyFilter : undefined,
              category: categoryFilter !== 'all' ? categoryFilter : undefined,
              from: dateFilter?.startDate || undefined,
              to: dateFilter?.endDate || undefined,
            })}
            enabled={!!userId && !!businessId && !businessLoading && !permissionLoading && canView('finanzas')}
            onMeta={({ count }) => setTxCount(count)}
            getItemKey={(transaction) => transaction.id}
            emptyMessage="No hay transacciones registradas"
            loadingMessage="Cargando transacciones..."
            renderItem={(transaction) => (
              <PendingSyncRow pending={Boolean(transaction._pending)}>
                {/* Icono + descripción + fecha (ancho completo en móvil) */}
                <div className="flex min-w-0 items-start gap-3 sm:items-center">
                  <div className={`shrink-0 rounded-full p-2 ${transaction.type === 'income' ? 'bg-success/10' : 'bg-destructive/10'
                    }`}>
                    {transaction.type === 'income' ?
                      <TrendingUp className="h-4 w-4 text-success" /> :
                      <TrendingDown className="h-4 w-4 text-destructive" />
                    }
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium break-words">{transaction.description}</div>
                    <div className="text-sm text-muted-foreground">
                      {format(new Date(transaction.date), 'PPP', { locale: es })}
                    </div>
                  </div>
                </div>

                {/* Importe + categoría (izq.) y acciones (der.); 2ª fila en móvil */}
                <div className="flex items-center justify-between gap-3 border-t pt-3 sm:shrink-0 sm:justify-end sm:gap-4 sm:border-0 sm:pt-0">
                  <div className="flex min-w-0 flex-col items-start gap-1 sm:items-end">
                    <div className={`whitespace-nowrap font-semibold ${transaction.type === 'income' ? 'text-success' : 'text-destructive'
                      }`}>
                      {transaction.type === 'income' ? '+' : '−'} {formatCurrency(transaction.amount, transaction.currency)}
                    </div>
                    <Badge variant="outline" className="max-w-full truncate">{transaction.category}</Badge>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    <ActionButtons module="finanzas">
                      <Button
                        variant="ghost"
                        size="sm"
                        action="edit"
                        disabled={Boolean(transaction._pending)}
                        onClick={() => handleEdit(transaction)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        action="view"
                        onClick={() => handleView(transaction)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </ActionButtons>
                  </div>
                </div>
              </PendingSyncRow>
            )}
          />
        </CardContent>
      </Card>

      {/* Modal de transacción */}
      <TransactionModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        transaction={selectedTransaction}
        onSubmit={handleTransactionSubmit}
        categories={categories}
        paymentMethods={paymentMethods}
        currencies={businessCurrencies}
        contacts={contactsData?.data || []}
        products={productsData || []}
        submitting={false}

        readonly={selectedTransaction?.readonly || !canEdit('finanzas')}
      />
    </div>
  )
}
