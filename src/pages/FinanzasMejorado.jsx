import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createTransaction, updateTransaction, listTransactions, getFinanceCategories, getPaymentMethods, getFilteredTotals, exportTransactions } from '@/services/finanzas'
import { Button } from '@/components/ui/button'
import { Wallet, Plus, TrendingUp, TrendingDown, ChevronLeft, ChevronRight, Pencil, Eye, Download } from 'lucide-react'
import { useSession } from '@/hooks/useSession'
import { useBusiness } from '@/context/BusinessContext'
import { useSubscription } from '@/context/SubscriptionContext'
import { useCurrency } from '@/context/CurrencyContext'
import { PermissionGuard, usePermissionCheck, ActionButtons } from '@/components/common/PermissionGuard'
import { TransactionModal } from '@/components/finanzas/TransactionModal'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Badge } from '@/components/ui/badge'
import DateRangeFilter from '@/components/common/DateRangeFilter'
import { notify, getSupabaseErrorMessage } from '@/services/notifications'

export default function FinanzasMejorado() {
  const { session } = useSession()
  const { businessId, loading: businessLoading } = useBusiness()
  const { checkLimit, recordUsage, getRemainingUsage, subscription, PLAN_LIMITS } = useSubscription()
  const { businessCurrencies, formatCurrency } = useCurrency()
  const { canView, canEdit, canExport, loading: permissionLoading } = usePermissionCheck()
  const queryClient = useQueryClient()

  // Estado local
  const [page, setPage] = useState(1)
  const pageSize = 5;
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

  const remainingTransactions = getRemainingUsage('monthly_transactions')
  const transactionsLimit = (PLAN_LIMITS?.[subscription?.plan_id || 'free']?.monthly_transactions) ?? 40
  const remainingDisplay = transactionsLimit === Infinity ? 'Ilimitadas' : remainingTransactions

  // Queries
  const { data: transactionsData, isLoading: isLoadingTransactions } = useQuery({
    queryKey: ['transactions', { userId, businessId, page, pageSize, currencyFilter, categoryFilter, dateKey }],
    queryFn: () => listTransactions({
      userId,
      businessId,
      page,
      pageSize,
      currency: currencyFilter !== 'all' ? currencyFilter : undefined,
      category: categoryFilter !== 'all' ? categoryFilter : undefined,
      from: dateFilter?.startDate || undefined,
      to: dateFilter?.endDate || undefined,
    }),
    enabled: !!userId && !!businessId && !businessLoading && !permissionLoading && canView('finanzas'),
  })

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

  const { data: filteredTotals } = useQuery({
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

  // Mutaciones
  const createMutation = useMutation({
    mutationFn: async (payload) => {
      const fullPayload = { ...payload, user_id: userId }
      return createTransaction(fullPayload, userId, businessId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['filteredTotals'] })
      recordUsage('monthly_transactions')
      setModalOpen(false)
      setSelectedTransaction(null)
    },
    onError: (error) => {
      const msg = getSupabaseErrorMessage(error)
      notify.error(msg)
    }
  })

  const updateMutation = useMutation({
    mutationFn: async (payload) => {
      const { id, ...rest } = payload
      const fullPayload = { ...rest, user_id: userId }
      return updateTransaction(id, fullPayload, userId, businessId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['filteredTotals'] })
      setModalOpen(false)
      setSelectedTransaction(null)
    },
    onError: (error) => {
      const msg = getSupabaseErrorMessage(error)
      notify.error(msg)
    }
  })

  // Handlers
  const handleCreate = () => {
    if (!checkLimit('monthly_transactions')) return
    setSelectedTransaction(null)
    setModalOpen(true)
  }

  const handleEdit = (transaction) => {
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

  const totalPages = Math.ceil(((transactionsData?.count || 0) / 5)) || 1
  const rows = transactionsData?.data ?? []
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
            {subscription?.plan_id === 'free' && (
              <div className="text-xs font-normal text-muted-foreground mt-1">
                Transacciones restantes: {remainingDisplay} / {transactionsLimit}
              </div>
            )}
          </div>
        </h1>

        <div className="flex gap-2">
          <PermissionGuard permission="finanzas.export">
            <Button variant="outline" onClick={handleExport} disabled={isExporting}>
              <Download className="mr-2 h-4 w-4" />
              Exportar
            </Button>
          </PermissionGuard>

          <PermissionGuard permission="finanzas.create">
            <Button onClick={handleCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Nueva Transacción
            </Button>
          </PermissionGuard>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 w-full">
          <div className="w-full sm:col-span-2">
            <DateRangeFilter onFilterChange={handleDateSelect} />
          </div>

          <Select value={currencyFilter} onValueChange={setCurrencyFilter}>
            <SelectTrigger className="w-full">
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

          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-full">
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

      {/* Resumen de totales */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Ingresos</CardTitle>
            <TrendingUp className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {financeSummary.map(item => (
                <div key={item.code} className={`font-bold text-success ${financeSummary.length > 1 ? 'text-lg' : 'text-2xl'}`}>
                  {formatCurrency(item.income, item.code)}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Gastos</CardTitle>
            <TrendingDown className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {financeSummary.map(item => (
                <div key={item.code} className={`font-bold text-destructive ${financeSummary.length > 1 ? 'text-lg' : 'text-2xl'}`}>
                  {formatCurrency(item.expense, item.code)}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Balance Neto</CardTitle>
            <Wallet className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {financeSummary.map(item => (
                <div
                  key={item.code}
                  className={`font-bold ${item.net >= 0 ? 'text-success' : 'text-destructive'} ${financeSummary.length > 1 ? 'text-lg' : 'text-2xl'}`}
                >
                  {formatCurrency(item.net, item.code)}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Transacciones</CardTitle>
            <div className="h-4 w-4 text-gray-600">#</div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-600">
              {transactionsData?.count || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabla de transacciones */}
      <Card>
        <CardHeader>
          <CardTitle>Transacciones</CardTitle>
        </CardHeader>
        <CardContent>
          {(businessLoading || permissionLoading || isLoadingTransactions) ? (
            <div className="text-center py-8">Cargando transacciones...</div>
          ) : (
            <div className="space-y-4">
              {rows.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No hay transacciones registradas
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    {rows.map(transaction => (
                      <div key={transaction.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-4">
                          <div className={`p-2 rounded-full ${transaction.type === 'income' ? 'bg-success/10' : 'bg-destructive/10'
                            }`}>
                            {transaction.type === 'income' ?
                              <TrendingUp className="w-4 h-4 text-success" /> :
                              <TrendingDown className="w-4 h-4 text-destructive" />
                            }
                          </div>
                          <div>
                            <div className="font-medium">{transaction.description}</div>
                            <div className="text-sm text-muted-foreground">
                              {format(new Date(transaction.date), 'PPP', { locale: es })}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <div className={`font-semibold ${transaction.type === 'income' ? 'text-success' : 'text-destructive'
                              }`}>
                              {formatCurrency(transaction.amount, transaction.currency)}
                            </div>
                            <Badge variant="outline">{transaction.category}</Badge>
                          </div>

                          <ActionButtons module="finanzas">
                            <Button
                              variant="ghost"
                              size="sm"
                              action="edit"
                              onClick={() => handleEdit(transaction)}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>

                            <Button
                              variant="ghost"
                              size="sm"
                              action="view"
                              onClick={() => handleView(transaction)}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          </ActionButtons>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Paginación */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                      >
                        <ChevronLeft className="w-4 h-4" />
                        Anterior
                      </Button>

                      <span className="text-sm text-muted-foreground">
                        Página {page} de {totalPages}
                      </span>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                      >
                        Siguiente
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de transacción */}
      <TransactionModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        transaction={selectedTransaction}
        onSubmit={selectedTransaction?.id ? updateMutation.mutate : createMutation.mutate}
        categories={categories}
        paymentMethods={paymentMethods}
        currencies={businessCurrencies}
        readonly={selectedTransaction?.readonly || !canEdit('finanzas')}
      />
    </div>
  )
}
