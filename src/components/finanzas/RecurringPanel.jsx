/* eslint-disable react/prop-types */
import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Plus,
  Pencil,
  Pause,
  Play,
  Trash2,
  RefreshCw,
  Repeat,
  TrendingUp,
  TrendingDown,
} from 'lucide-react'
import { format, parseISO, isValid } from 'date-fns'
import { es } from 'date-fns/locale'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { PermissionGuard } from '@/components/common/PermissionGuard'
import { RecurringModal } from '@/components/finanzas/RecurringModal'
import { notify, getSupabaseErrorMessage } from '@/services/notifications'
import {
  FREQUENCY_LABELS,
  listRecurringTransactions,
  createRecurringTransaction,
  updateRecurringTransaction,
  setRecurringActive,
  deleteRecurringTransaction,
  generateDueRecurring,
  runRecurringNow,
} from '@/services/recurringTransactions'

function formatNextRun(value) {
  if (!value) return '—'
  const d = typeof value === 'string' && value.length <= 10
    ? parseISO(value)
    : new Date(value)
  if (!isValid(d)) return String(value)
  return format(d, 'PPP', { locale: es })
}

export function RecurringPanel({
  userId,
  businessId,
  businessLoading,
  categories,
  paymentMethods,
  currencies,
  contacts,
  formatCurrency,
  canCreate,
}) {
  const queryClient = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [selected, setSelected] = useState(null)
  const [deleteId, setDeleteId] = useState(null)
  const generatedRef = useRef(false)

  const queryKey = ['recurring-transactions', businessId || userId]

  const { data: items = [], isLoading } = useQuery({
    queryKey,
    queryFn: () => listRecurringTransactions({ userId, businessId }),
    enabled: !!userId && !!businessId && !businessLoading,
  })

  const invalidateFinance = () => {
    queryClient.invalidateQueries({ queryKey })
    queryClient.invalidateQueries({ queryKey: ['transactions'] })
    queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    queryClient.invalidateQueries({ queryKey: ['filteredTotals'] })
    queryClient.invalidateQueries({ queryKey: ['open-accounts'] })
    queryClient.invalidateQueries({ queryKey: ['open-accounts-count'] })
    queryClient.invalidateQueries({ queryKey: ['aging'] })
    queryClient.invalidateQueries({ queryKey: ['balanceConfig'] })
  }

  // Al abrir Finanzas: materializa vencidos una vez por montaje.
  useEffect(() => {
    if (!userId || !businessId || businessLoading || !canCreate || generatedRef.current) return
    generatedRef.current = true
    generateDueRecurring()
      .then((res) => {
        if (res?.created > 0) {
          notify.success(
            res.created === 1
              ? 'Se anotó 1 movimiento recurrente que estaba pendiente.'
              : `Se anotaron ${res.created} movimientos recurrentes pendientes.`
          )
          invalidateFinance()
        }
        if (res?.limit_hit) {
          notify.warning('Se alcanzó el límite de transacciones del plan. Algunas repeticiones quedaron pendientes.')
        }
      })
      .catch(() => {
        // Silencioso: no bloquear Finanzas si falla la generación.
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, businessId, businessLoading, canCreate])

  const saveMutation = useMutation({
    mutationFn: async (payload) => {
      if (payload.id) {
        const { id, ...rest } = payload
        return updateRecurringTransaction(id, rest, userId, businessId)
      }
      return createRecurringTransaction(payload, userId, businessId)
    },
    onSuccess: (_data, vars) => {
      notify.success(vars.id ? 'Repetición actualizada' : 'Repetición creada')
      setModalOpen(false)
      setSelected(null)
      invalidateFinance()
    },
    onError: (error) => notify.error(getSupabaseErrorMessage(error)),
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, is_active }) => setRecurringActive(id, is_active, userId, businessId),
    onSuccess: (_d, vars) => {
      notify.success(vars.is_active ? 'Repetición activada' : 'Repetición pausada')
      invalidateFinance()
    },
    onError: (error) => notify.error(getSupabaseErrorMessage(error)),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => deleteRecurringTransaction(id, userId, businessId),
    onSuccess: () => {
      notify.success('Repetición eliminada')
      setDeleteId(null)
      invalidateFinance()
    },
    onError: (error) => notify.error(getSupabaseErrorMessage(error)),
  })

  const runNowMutation = useMutation({
    mutationFn: (id) => runRecurringNow(id),
    onSuccess: (txId) => {
      if (txId == null) {
        notify.info('Ese movimiento ya estaba anotado para hoy.')
      } else {
        notify.success('Movimiento registrado')
      }
      invalidateFinance()
    },
    onError: (error) => notify.error(getSupabaseErrorMessage(error)),
  })

  const openCreate = () => {
    setSelected(null)
    setModalOpen(true)
  }

  const openEdit = (item) => {
    setSelected(item)
    setModalOpen(true)
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <CardTitle className="flex items-center gap-2 text-base">
                <Repeat className="h-4 w-4 text-primary" />
                Se repiten solos
              </CardTitle>
              <CardDescription className="mt-1">
                Alquiler, nómina, internet… Gestia los anota cuando toca, sin que te acuerdes.
              </CardDescription>
            </div>
            <PermissionGuard permission="finanzas.create">
              <Button type="button" className="w-full shrink-0 sm:w-auto" onClick={openCreate}>
                <Plus className="mr-2 h-4 w-4" />
                Nueva repetición
              </Button>
            </PermissionGuard>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="py-4 text-sm text-muted-foreground">Cargando repeticiones…</p>
          ) : items.length === 0 ? (
            <div className="rounded-lg border border-dashed p-4 text-center sm:p-6">
              <p className="text-sm text-muted-foreground">
                Aún no tienes nada que se repita. Crea uno (por ejemplo “Alquiler”) y elige cada mes.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item) => {
                const isIncome = item.type === 'income'
                return (
                  <div
                    key={item.id}
                    className={`rounded-lg border p-3 sm:p-4 ${item.is_active ? '' : 'opacity-70'}`}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex min-w-0 items-start gap-3">
                        <div className={`shrink-0 rounded-full p-2 ${isIncome ? 'bg-success/10' : 'bg-destructive/10'}`}>
                          {isIncome
                            ? <TrendingUp className="h-4 w-4 text-success" />
                            : <TrendingDown className="h-4 w-4 text-destructive" />}
                        </div>
                        <div className="min-w-0 space-y-1">
                          <div className="font-medium break-words">{item.description}</div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge variant="outline">{FREQUENCY_LABELS[item.frequency] || item.frequency}</Badge>
                            <Badge variant="secondary">{item.category}</Badge>
                            {!item.is_active && <Badge variant="outline">Pausada</Badge>}
                            {item.status === 'pending' && <Badge variant="outline">Queda pendiente</Badge>}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Próxima: {formatNextRun(item.next_run)}
                            {item.contact?.name ? ` · ${item.contact.name}` : ''}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2 border-t pt-3 sm:flex-col sm:items-end sm:border-0 sm:pt-0">
                        <div className={`font-semibold tabular-nums ${isIncome ? 'text-success' : 'text-destructive'}`}>
                          {isIncome ? '+' : '−'} {formatCurrency(item.amount, item.currency)}
                        </div>
                        <div className="flex shrink-0 items-center gap-0.5">
                          <PermissionGuard permission="finanzas.create">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              title="Registrar ahora"
                              disabled={!item.is_active || runNowMutation.isPending}
                              onClick={() => runNowMutation.mutate(item.id)}
                            >
                              <RefreshCw className="h-4 w-4" />
                            </Button>
                          </PermissionGuard>
                          <PermissionGuard permission="finanzas.edit">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              title={item.is_active ? 'Pausar' : 'Activar'}
                              onClick={() => toggleMutation.mutate({ id: item.id, is_active: !item.is_active })}
                            >
                              {item.is_active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                            </Button>
                            <Button type="button" variant="ghost" size="sm" title="Editar" onClick={() => openEdit(item)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </PermissionGuard>
                          <PermissionGuard permission="finanzas.delete">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              title="Eliminar"
                              onClick={() => setDeleteId(item.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </PermissionGuard>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <RecurringModal
        open={modalOpen}
        onOpenChange={(o) => {
          setModalOpen(o)
          if (!o) setSelected(null)
        }}
        onSubmit={saveMutation.mutate}
        item={selected}
        categories={categories}
        paymentMethods={paymentMethods}
        currencies={currencies}
        contacts={contacts}
        submitting={saveMutation.isPending}
      />

      <ConfirmDialog
        open={Boolean(deleteId)}
        onOpenChange={(o) => { if (!o) setDeleteId(null) }}
        title="¿Eliminar esta repetición?"
        description="Los movimientos que ya se anotaron se quedan. Solo dejas de repetir este en el futuro."
        confirmText="Eliminar"
        cancelText="Cancelar"
        tone="destructive"
        onConfirm={() => deleteMutation.mutate(deleteId)}
      />
    </>
  )
}
