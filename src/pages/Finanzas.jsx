import { useEffect, useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { createTransaction, updateTransaction, listTransactions, getFinanceCategories, getPaymentMethods, getBankAccounts, computeTotals, getFilteredTotals } from '@/services/finanzas'
import { Button } from '@/components/ui/button'
import { Wallet, Plus, TrendingUp, TrendingDown, ChevronLeft, ChevronRight, Pencil } from 'lucide-react'
import { useSession } from '@/hooks/useSession'
import { TransactionModal } from '@/components/finanzas/TransactionModal'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { endOfDay, format, startOfDay } from 'date-fns'
import { es } from 'date-fns/locale'
import { Badge } from '@/components/ui/badge'
import { Calendar } from '@/components/ui/calendar'

export default function Finanzas() {
  const { session } = useSession()
  const queryClient = useQueryClient()

  // Pagination state
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(5)
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedTransaction, setSelectedTransaction] = useState(null)
  const [currencyFilter, setCurrencyFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState(null)

  const userId = session?.user?.id
  const dateKey = dateFilter ? format(dateFilter, 'yyyy-MM-dd') : null

  // 1. Transactions Query (Paginated)
  const { data: transactionsData, isLoading: isLoadingTransactions } = useQuery({
    queryKey: ['transactions', { userId, page, pageSize, currencyFilter, categoryFilter, dateKey }],
    queryFn: () =>
      listTransactions({
        userId,
        page,
        pageSize,
        currency: currencyFilter === 'all' ? undefined : currencyFilter,
        category: categoryFilter === 'all' ? undefined : categoryFilter,
        from: dateFilter ? startOfDay(dateFilter).toISOString() : undefined,
        to: dateFilter ? endOfDay(dateFilter).toISOString() : undefined,
      }),
    enabled: !!userId,
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

  // 4. Bank Accounts Query
  const { data: bankAccounts = [] } = useQuery({
    queryKey: ['bankAccounts', userId],
    queryFn: () => getBankAccounts(userId),
    enabled: !!userId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  })

  // 5. Global Filtered Totals (Not Paginated)
  const { data: filteredTotals = { income_usd: 0, income_cup: 0, expense_usd: 0, expense_cup: 0 } } = useQuery({
    queryKey: ['filteredTotals', { userId, currencyFilter, categoryFilter, dateKey }],
    queryFn: () =>
      getFilteredTotals({
        userId,
        currency: currencyFilter === 'all' ? undefined : currencyFilter,
        category: categoryFilter === 'all' ? undefined : categoryFilter,
        from: dateFilter ? startOfDay(dateFilter).toISOString() : undefined,
        to: dateFilter ? endOfDay(dateFilter).toISOString() : undefined,
      }),
    enabled: !!userId,
  })

  // Create Transaction Mutation
  const createMutation = useMutation({
    mutationFn: async (payload) => {
      const fullPayload = {
        ...payload,
        user_id: userId
      }
      return createTransaction(fullPayload)
    },
    onSuccess: () => {
      // Invalidate transactions to refetch the list
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['filteredTotals'] })
      setModalOpen(false)
      setSelectedTransaction(null)
    },
    onError: (error) => {
      console.error('Error al guardar:', error)
      alert("Error al guardar: " + error.message)
    }
  })

  const updateMutation = useMutation({
    mutationFn: async (payload) => {
      const { id, ...rest } = payload
      const fullPayload = {
        ...rest,
        user_id: userId
      }
      return updateTransaction(id, fullPayload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['filteredTotals'] })
      setModalOpen(false)
      setSelectedTransaction(null)
    },
    onError: (error) => {
      console.error('Error al actualizar:', error)
      alert("Error al actualizar: " + error.message)
    }
  })

  const handleSave = (payload) => {
    if (payload?.id) updateMutation.mutate(payload)
    else createMutation.mutate(payload)
  }

  const handleModalOpenChange = (nextOpen) => {
    setModalOpen(nextOpen)
    if (!nextOpen) setSelectedTransaction(null)
  }

  // Derived state
  const rows = transactionsData?.data || []
  const totalCount = transactionsData?.count || 0
  const totalPages = Math.ceil(totalCount / pageSize)

  // Note: Totals here are calculated based on the CURRENT PAGE data. 
  // Ideally, this should be a separate query for global stats, but keeping consistent with previous behavior for now.
  const totals = computeTotals(rows)

  const clearFilters = () => {
    setCurrencyFilter('all')
    setCategoryFilter('all')
    setDateFilter(null)
    setPage(1)
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Wallet className="w-8 h-8 text-primary" />
            </div>
            Gestión Financiera
          </h1>
          <p className="text-muted-foreground mt-1">Control de ingresos, gastos y conciliaciones.</p>
        </div>
        <Button onClick={() => { setSelectedTransaction(null); setModalOpen(true) }} className="w-full sm:w-auto shadow-lg hover:shadow-xl transition-all">
          <Plus className="w-4 h-4 mr-2" /> Nuevo Movimiento
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-green-50 to-white border-green-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-green-700">Ingresos USD</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold text-green-700">${filteredTotals.income_usd.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-50 to-white border-green-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-green-700">Ingresos CUP</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold text-green-700">${filteredTotals.income_cup.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-red-50 to-white border-red-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-red-700">Gastos USD</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold text-red-700">${filteredTotals.expense_usd.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-red-50 to-white border-red-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-red-700">Gastos CUP</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold text-red-700">${filteredTotals.expense_cup.toFixed(2)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Transaction List */}
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle>Movimientos Recientes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <div className="text-sm font-medium">Moneda</div>
                <Select value={currencyFilter} onValueChange={setCurrencyFilter}>
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="CUP">CUP</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <div className="text-sm font-medium">Categoría</div>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[240px]">
                    <SelectItem value="all">Todas</SelectItem>
                    {availableCategoryOptions.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <div className="text-sm font-medium">Fecha</div>
                <Calendar
                  value={dateFilter}
                  onChange={setDateFilter}
                  placeholder="Todas las fechas"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <Button variant="outline" onClick={clearFilters}>
                Limpiar filtros
              </Button>
            </div>

            <div className="rounded-md border overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className="p-3 sm:p-4 font-medium">Fecha</th>
                    <th className="p-3 sm:p-4 font-medium">Categoría</th>
                    <th className="hidden md:table-cell p-3 sm:p-4 font-medium">Descripción</th>
                    <th className="hidden md:table-cell p-3 sm:p-4 font-medium">Método</th>
                    <th className="p-3 sm:p-4 font-medium text-right">Monto</th>
                    <th className="p-3 sm:p-4 font-medium text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {isLoadingTransactions ? (
                    <tr><td colSpan="6" className="p-8 text-center text-muted-foreground">Cargando...</td></tr>
                  ) : rows.length === 0 ? (
                    <tr><td colSpan="6" className="p-8 text-center text-muted-foreground">No hay registros aún.</td></tr>
                  ) : (
                    rows.map((r) => {
                      const isIncome = r.type === 'income'
                      const details = r.details || {}
                      return (
                        <tr key={r.id} className="hover:bg-muted/30 transition-colors group">
                          <td className="p-3 sm:p-4 whitespace-nowrap">
                            <div className="flex flex-col">
                              <span className="font-medium">{format(new Date(r.date), 'dd MMM yyyy', { locale: es })}</span>
                              <span className="text-xs text-muted-foreground">{format(new Date(r.date), 'HH:mm')}</span>
                              <div className="md:hidden mt-2 space-y-1 max-w-[220px]">
                                <div className="text-xs text-muted-foreground truncate" title={r.description}>
                                  {r.description}
                                </div>
                                <div className="text-xs text-muted-foreground capitalize">
                                  {details.payment_method ? details.payment_method : '-'}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="p-3 sm:p-4">
                            <Badge variant="outline" className="bg-background">
                              {r.category}
                            </Badge>
                          </td>
                          <td className="hidden md:table-cell p-3 sm:p-4 max-w-[200px] truncate" title={r.description}>
                            <div className="font-medium">{r.description}</div>
                            {details.notes && (
                              <div className="text-xs text-muted-foreground mt-1">{details.notes}</div>
                            )}
                          </td>
                          <td className="hidden md:table-cell p-3 sm:p-4 text-muted-foreground text-xs">
                            {details.payment_method ? (
                              <span className="capitalize">{details.payment_method}</span>
                            ) : '-'}
                          </td>
                          <td className={`p-3 sm:p-4 text-right font-bold ${isIncome ? 'text-green-600' : 'text-red-600'}`}>
                            {isIncome ? '+' : '-'}{Number(r.amount).toFixed(2)} <span className="text-xs font-normal text-muted-foreground">{r.currency}</span>
                          </td>
                          <td className="p-3 sm:p-4 text-right">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => { setSelectedTransaction(r); setModalOpen(true) }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <span>Filas por página:</span>
                <Select
                  value={pageSize.toString()}
                  onValueChange={(v) => {
                    setPageSize(Number(v))
                    setPage(1) // Reset to page 1 when changing size
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
                    onClick={() => setPage(old => Math.max(old - 1, 1))}
                    disabled={page === 1 || isLoadingTransactions}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setPage(old => (totalPages > old ? old + 1 : old))}
                    disabled={page >= totalPages || isLoadingTransactions}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <TransactionModal
        open={modalOpen}
        onOpenChange={handleModalOpenChange}
        onSubmit={handleSave}
        categories={categories}
        paymentMethods={paymentMethods}
        bankAccounts={bankAccounts}
        transaction={selectedTransaction}
      />
    </div>
  )
}
