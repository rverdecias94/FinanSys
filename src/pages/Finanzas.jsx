import { useEffect, useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { createTransaction, updateTransaction, listTransactions, getFinanceCategories, getPaymentMethods, computeTotals, getFilteredTotals } from '@/services/finanzas'
import { Button } from '@/components/ui/button'
import { Wallet, Plus, TrendingUp, TrendingDown, ChevronLeft, ChevronRight, Pencil } from 'lucide-react'
import { useSession } from '@/hooks/useSession'
import { useBusiness } from '@/context/BusinessContext'
import { useSubscription } from '@/context/SubscriptionContext'
import { useCurrency } from '@/context/CurrencyContext'
import { usePermissions } from '@/context/PermissionContext'
import { TransactionModal } from '@/components/finanzas/TransactionModal'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Badge } from '@/components/ui/badge'
import DateRangeFilter from '@/components/common/DateRangeFilter'
import { notify, getSupabaseErrorMessage } from '@/services/notifications'

export default function Finanzas() {
  const { session } = useSession()
  const { businessId } = useBusiness()
  const { checkLimit, recordUsage, getRemainingUsage, subscription } = useSubscription()
  const { businessCurrencies, formatCurrency } = useCurrency()
  const { hasPermission } = usePermissions()
  const queryClient = useQueryClient()

  // Pagination state
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(5)
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedTransaction, setSelectedTransaction] = useState(null)
  const [currencyFilter, setCurrencyFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState(null)

  const userId = session?.user?.id // ID real del usuario
  const dateKey = dateFilter ? JSON.stringify(dateFilter) : null

  const handleDateSelect = (filter) => {
    setDateFilter(filter)
  }

  const remainingTransactions = getRemainingUsage('monthly_transactions')
  const transactionsLimit = subscription?.plan_id === 'premium' ? Infinity : 40
  const remainingDisplay = transactionsLimit === Infinity ? 'Ilimitadas' : remainingTransactions

  // 1. Transactions Query (Paginated)
  const { data: transactionsData, isLoading: isLoadingTransactions } = useQuery({
    queryKey: ['transactions', { userId, businessId, page, pageSize, currencyFilter, categoryFilter, dateKey }], // Agregar businessId
    queryFn: () =>
      listTransactions({
        userId,
        businessId, // Pasar businessId
        page,
        pageSize,
        currency: currencyFilter === 'all' ? undefined : currencyFilter,
        category: categoryFilter === 'all' ? undefined : categoryFilter,
        from: dateFilter?.startDate || undefined,
        to: dateFilter?.endDate || undefined,
      }),
    enabled: !!userId && !!businessId, // Asegurar que ambos estén disponibles
    placeholderData: keepPreviousData, // Keeps previous data while fetching new page
  })

  // 2. Categories Query
  const { data: categories = { income: [], expense: [] } } = useQuery({
    queryKey: ['financeCategories'],
    queryFn: getFinanceCategories,
    staleTime: 1000 * 60 * 60, // 1 hour
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

  // 4. (Removed) Bank Accounts Query - tabla no existente

  // 5. Global Filtered Totals (Not Paginated)
  const { data: filteredTotals = { income: {}, expense: {} } } = useQuery({
    queryKey: ['filteredTotals', { userId, businessId, currencyFilter, categoryFilter, dateKey }], // Agregar businessId
    queryFn: () =>
      getFilteredTotals({
        userId,
        businessId, // Pasar businessId
        currency: currencyFilter === 'all' ? undefined : currencyFilter,
        category: categoryFilter === 'all' ? undefined : categoryFilter,
        from: dateFilter?.startDate || undefined,
        to: dateFilter?.endDate || undefined,
      }),
    enabled: !!userId && !!businessId, // Asegurar que ambos estén disponibles
  })

  // Create Transaction Mutation
  const createMutation = useMutation({
    mutationFn: async (payload) => {
      const fullPayload = {
        ...payload,
        user_id: userId
      }
      return createTransaction(fullPayload, userId, businessId) // Pasar ambos IDs
    },
    onSuccess: () => {
      // Invalidate transactions to refetch the list
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
      const fullPayload = {
        ...rest,
        user_id: userId
      }
      return updateTransaction(id, fullPayload, userId, businessId) // Pasar ambos IDs
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

  const handleCreate = () => {
    if (!checkLimit('monthly_transactions')) return
    setSelectedTransaction(null)
    setModalOpen(true)
  }

  const handleEdit = (transaction) => {
    setSelectedTransaction(transaction)
    setModalOpen(true)
  }

  const totalPages = Math.ceil((transactionsData?.count || 0) / pageSize) || 1

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
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
        {hasPermission('finanzas.create') && (
          <Button onClick={handleCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Nueva Transacción
          </Button>
        )}
      </div>

      {/* Filters */}
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
              {businessCurrencies.map((c) => (
                <SelectItem key={c.code} value={c.code}>{c.code}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Todas las categorías" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las categorías</SelectItem>
              {availableCategoryOptions.map((cat) => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>

        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Object.entries(filteredTotals.income).map(([currency, amount]) => (
          <Card key={`income-${currency}`} className="bg-green-50/50 border-green-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-green-800">Ingresos {currency}</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-900">{formatCurrency(amount, currency)}</div>
            </CardContent>
          </Card>
        ))}
        {Object.entries(filteredTotals.expense).map(([currency, amount]) => (
          <Card key={`expense-${currency}`} className="bg-red-50/50 border-red-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-red-800">Gastos {currency}</CardTitle>
              <TrendingDown className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-900">{formatCurrency(amount, currency)}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Transactions Table */}
      <div className="border rounded-md">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/20">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium">Fecha</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Descripción</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Categoría</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Monto</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Moneda</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Tipo</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {isLoadingTransactions ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    Cargando transacciones...
                  </td>
                </tr>
              ) : transactionsData?.data?.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    No hay transacciones registradas
                  </td>
                </tr>
              ) : (
                transactionsData?.data?.map((transaction) => (
                  <tr key={transaction.id} className="border-b hover:bg-muted/10">
                    <td className="px-4 py-3 text-sm">{format(new Date(transaction.date), 'dd/MM/yyyy', { locale: es })}</td>
                    <td className="px-4 py-3 text-sm font-medium">{transaction.description}</td>
                    <td className="px-4 py-3 text-sm">
                      <Badge variant="outline">{transaction.category}</Badge>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium">
                      {formatCurrency(transaction.amount, transaction.currency)}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <Badge variant="secondary">{transaction.currency}</Badge>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <Badge variant={transaction.type === 'income' ? 'default' : 'destructive'}>
                        {transaction.type === 'income' ? 'Ingreso' : 'Gasto'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {hasPermission('finanzas.edit') && (
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(transaction)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <span>Filas por página:</span>
          <Select
            value={pageSize.toString()}
            onValueChange={(v) => {
              setPageSize(Number(v))
              setPage(1)
            }}
          >
            <SelectTrigger className="w-[70px] h-8">
              <SelectValue placeholder="5" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="5">5</SelectItem>
              <SelectItem value="10">10</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-4">
          <span>
            Página {page} de {totalPages || 1}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1 || isLoadingTransactions}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page >= totalPages || isLoadingTransactions}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <TransactionModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        transaction={selectedTransaction}
        onSubmit={(payload) => {
          const action = selectedTransaction ? updateMutation.mutate : createMutation.mutate
          action(payload)
        }}
        categories={categories}
        paymentMethods={paymentMethods}
        currencies={businessCurrencies}
        isLoading={createMutation.isPending || updateMutation.isPending}
      />
    </div>
  )
}
