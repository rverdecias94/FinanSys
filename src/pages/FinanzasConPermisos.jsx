import { useEffect, useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { createTransaction, updateTransaction, listTransactions, getFinanceCategories, getPaymentMethods, computeTotals, getFilteredTotals } from '@/services/finanzas'
import { Button } from '@/components/ui/button'
import { Wallet, Plus, TrendingUp, TrendingDown, ChevronLeft, ChevronRight, Pencil, Eye, Download } from 'lucide-react'
import { useSession } from '@/hooks/useSession'
import { useBusiness } from '@/context/BusinessContext'
import { useSubscription } from '@/context/SubscriptionContext'
import { useCurrency } from '@/context/CurrencyContext'
import { PermissionWrapper, usePagePermissions, PermissionGuard, ActionButtons } from '@/components/common/PermissionWrapper'
import { TransactionModal } from '@/components/finanzas/TransactionModal'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Badge } from '@/components/ui/badge'
import DateRangeFilter from '@/components/common/DateRangeFilter'
import { notify, getSupabaseErrorMessage } from '@/services/notifications'

export default function FinanzasConPermisos() {
  return (
    <PermissionWrapper 
      module="finanzas" 
      title="Finanzas"
      actions={{ create: true, edit: true, delete: true }}
    >
      {(permissions) => <FinanzasContent permissions={permissions} />}
    </PermissionWrapper>
  )
}

function FinanzasContent({ permissions }) {
  const { session } = useSession()
  const { businessId } = useBusiness()
  const { checkLimit, recordUsage, getRemainingUsage, subscription } = useSubscription()
  const { businessCurrencies, formatCurrency } = useCurrency()
  const queryClient = useQueryClient()

  // Estado local
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(5)
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedTransaction, setSelectedTransaction] = useState(null)
  const [currencyFilter, setCurrencyFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState(null)
  const [viewMode, setViewMode] = useState('list') // 'list' o 'readonly'

  const userId = session?.user?.id
  const dateKey = dateFilter ? JSON.stringify(dateFilter) : null

  const handleDateSelect = (filter) => {
    setDateFilter(filter)
  }

  const remainingTransactions = getRemainingUsage('monthly_transactions')
  const transactionsLimit = subscription?.plan_id === 'premium' ? Infinity : 40
  const remainingDisplay = transactionsLimit === Infinity ? 'Ilimitadas' : remainingTransactions

  // Queries
  const { data: transactionsData, isLoading: isLoadingTransactions } = useQuery({
    queryKey: ['transactions', { userId, businessId, page, pageSize, currencyFilter, categoryFilter, dateKey }],
    queryFn: () =>
      listTransactions({
        userId,
        businessId,
        page,
        pageSize,
        currency: currencyFilter === 'all' ? undefined : currencyFilter,
        category: categoryFilter === 'all' ? undefined : categoryFilter,
        from: dateFilter?.startDate || undefined,
        to: dateFilter?.endDate || undefined,
      }),
    enabled: !!userId && !!businessId && permissions.canView,
    placeholderData: keepPreviousData,
  })

  // 2. Categories Query
  const { data: categories = { income: [], expense: [] } } = useQuery({
    queryKey: ['financeCategories'],
    queryFn: getFinanceCategories,
    staleTime: 1000 * 60 * 60,
  })

  const availableCategoryOptions = useMemo(() => {
    const all = [...(categories?.income || []), ...(categories?.expense || [])]
    return Array.from(new Set(all)).sort((a, b) => a.localeCompare(b))
  }, [categories])

  useEffect(() => {
    setPage(1)
  }, [currencyFilter, categoryFilter, dateFilter])

  // 3. Payment Methods Query
  const { data: paymentMethods = [] } = useQuery({
    queryKey: ['paymentMethods'],
    queryFn: getPaymentMethods,
    staleTime: 1000 * 60 * 60,
  })

  // 5. Global Filtered Totals (Not Paginated)
  const { data: filteredTotals = { income: {}, expense: {} } } = useQuery({
    queryKey: ['filteredTotals', { userId, businessId, currencyFilter, categoryFilter, dateKey }],
    queryFn: () =>
      getFilteredTotals({
        userId,
        businessId,
        currency: currencyFilter === 'all' ? undefined : currencyFilter,
        category: categoryFilter === 'all' ? undefined : categoryFilter,
        from: dateFilter?.startDate || undefined,
        to: dateFilter?.endDate || undefined,
      }),
    enabled: !!userId && !!businessId,
    staleTime: 1000 * 60 * 5,
  })

  // Mutaciones
  const createTransactionMutation = useMutation({
    mutationFn: async (transactionData) => {
      return createTransaction({ ...transactionData, user_id: userId }, userId, businessId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      setModalOpen(false)
      setSelectedTransaction(null)
      notify.success('Transacción creada exitosamente')
    },
    onError: (error) => {
      notify.error('Error al crear transacción')
    }
  })

  const updateTransactionMutation = useMutation({
    mutationFn: async (transactionData) => {
      const { id, ...rest } = transactionData
      return updateTransaction(id, { ...rest, user_id: userId }, userId, businessId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      setModalOpen(false)
      setSelectedTransaction(null)
      notify.success('Transacción actualizada exitosamente')
    },
    onError: (error) => {
      notify.error('Error al actualizar transacción')
    }
  })

  // Handlers
  const handleCreate = () => {
    if (!permissions.canCreate) {
      notify.error('No tienes permisos para crear transacciones')
      return
    }

    const limitCheck = checkLimit('monthly_transactions', 1)
    if (!limitCheck.allowed) {
      notify.error(`Límite de transacciones mensuales alcanzado: ${limitCheck.limit}`)
      return
    }

    setSelectedTransaction(null)
    setModalOpen(true)
  }

  const handleEdit = (transaction) => {
    if (!permissions.canEdit) {
      notify.error('No tienes permisos para editar transacciones')
      return
    }
    setSelectedTransaction(transaction)
    setModalOpen(true)
  }

  const handleSave = async (transactionData) => {
    if (selectedTransaction) {
      await updateTransactionMutation.mutateAsync({
        ...selectedTransaction,
        ...transactionData
      })
    } else {
      await createTransactionMutation.mutateAsync(transactionData)
      recordUsage('monthly_transactions', 1)
    }
  }

  const handleExport = () => {
    if (!permissions.canExport) {
      notify.error('No tienes permisos para exportar datos')
      return
    }
    // Lógica de exportación
    notify.info('Función de exportación en desarrollo')
  }

  const totalPages = Math.ceil((transactionsData?.total || 0) / pageSize)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-3">
            <Wallet className="w-8 h-8 text-primary" />
            Finanzas
          </h1>
          <p className="text-muted-foreground">Gestiona tus ingresos y egresos</p>
        </div>
        
        <ActionButtons module="finanzas">
          <Button 
            action="create"
            onClick={handleCreate}
            disabled={!permissions.canCreate || remainingTransactions <= 0}
            className="gap-2"
          >
            <Plus className="w-4 h-4" />
            Nueva Transacción
          </Button>
          <Button 
            action="export"
            variant="outline" 
            onClick={handleExport}
            className="gap-2"
          >
            <Download className="w-4 h-4" />
            Exportar
          </Button>
        </ActionButtons>
      </div>

      {/* Permission Info */}
      {permissions.permissionModeEnabled && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-blue-800">
            <Eye className="w-4 h-4" />
            <span className="text-sm font-medium">Modo de Permisos Activado</span>
          </div>
          <p className="text-sm text-blue-700 mt-1">
            {permissions.canCreate 
              ? 'Puedes crear y editar transacciones' 
              : 'Solo puedes ver las transacciones existentes'
            }
          </p>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Ingresos</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            {businessCurrencies.map(curr => (
              <div key={curr.code} className="flex items-baseline gap-2">
                <span className="text-xl font-bold text-green-600">
                  {formatCurrency(filteredTotals.income[curr.code] || 0, curr.code)}
                </span>
                <span className="text-xs font-medium text-muted-foreground">{curr.code}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Gastos</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            {businessCurrencies.map(curr => (
              <div key={curr.code} className="flex items-baseline gap-2">
                <span className="text-xl font-bold text-red-600">
                  {formatCurrency(filteredTotals.expense[curr.code] || 0, curr.code)}
                </span>
                <span className="text-xs font-medium text-muted-foreground">{curr.code}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Beneficio Neto</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {businessCurrencies.map(curr => {
              const net = (filteredTotals.income[curr.code] || 0) - (filteredTotals.expense[curr.code] || 0)
              return (
                <div key={curr.code} className="flex items-baseline gap-2">
                  <span className={`text-xl font-bold ${net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(net, curr.code)}
                  </span>
                  <span className="text-xs font-medium text-muted-foreground">{curr.code}</span>
                </div>
              )
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Transacciones</CardTitle>
            <Plus className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{transactionsData?.total || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {remainingDisplay !== 'Ilimitadas' && `Disponibles: ${remainingDisplay}`}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col sm:flex-row gap-3">
          <Select value={currencyFilter} onValueChange={setCurrencyFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Moneda" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las monedas</SelectItem>
              {businessCurrencies.map(curr => (
                <SelectItem key={curr.code} value={curr.code}>{curr.code}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Categoría" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las categorías</SelectItem>
              {availableCategoryOptions.map(cat => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <DateRangeFilter onDateSelect={handleDateSelect} />
        </div>
      </div>

      {/* Transactions Table */}
      <Card>
        <CardHeader>
          <CardTitle>Transacciones Recientes</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingTransactions ? (
            <div className="text-center py-8">
              <div className="animate-pulse text-gray-500">Cargando transacciones...</div>
            </div>
          ) : (
            <div className="space-y-4">
              {transactionsData?.data?.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No hay transacciones registradas
                </div>
              ) : (
                <>
                  <div className="space-y-3">
                    {transactionsData?.data?.map((transaction) => (
                      <div key={transaction.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-4">
                          <div className={`w-2 h-8 rounded-full ${transaction.type === 'income' ? 'bg-green-500' : 'bg-red-500'}`} />
                          <div>
                            <div className="font-medium">{transaction.description || 'Sin descripción'}</div>
                            <div className="text-sm text-gray-500">
                              {transaction.category} • {format(new Date(transaction.date), 'dd MMM yyyy', { locale: es })}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <div className={`font-semibold ${transaction.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                              {formatCurrency(transaction.amount, transaction.currency)}
                            </div>
                            <div className="text-sm text-gray-500">{transaction.currency}</div>
                          </div>
                          
                          <ActionButtons module="finanzas">
                            <Button 
                              action="edit"
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleEdit(transaction)}
                              className="gap-2"
                            >
                              <Pencil className="w-4 h-4" />
                              Editar
                            </Button>
                          </ActionButtons>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between pt-4 border-t">
                      <div className="text-sm text-gray-500">
                        Página {page} de {totalPages} • Total: {transactionsData?.total} transacciones
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPage(p => Math.max(1, p - 1))}
                          disabled={page <= 1}
                        >
                          <ChevronLeft className="w-4 h-4" />
                          Anterior
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                          disabled={page >= totalPages}
                        >
                          Siguiente
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal */}
      <TransactionModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        transaction={selectedTransaction}
        onSave={handleSave}
        categories={categories}
        paymentMethods={paymentMethods}
        businessCurrencies={businessCurrencies}
      />
    </div>
  )
}