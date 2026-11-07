/* eslint-disable react/prop-types */
import { useEffect, useRef, useState } from 'react'
import { onlineManager, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { PermissionGuard } from '@/components/common/PermissionGuard'
import { PendingSyncRow } from '@/components/common/PendingSyncRow'
import { RecurringModal } from '@/components/finanzas/RecurringModal'
import { notify, getSupabaseErrorMessage } from '@/services/notifications'
import { notifyOfflineQueued } from '@/services/notifyWrap'
import {
  FREQUENCY_LABELS,
  listRecurringTransactions,
  generateDueRecurring,
  runRecurringNow,
} from '@/services/recurringTransactions'
import { genClientUuid } from '@/offline/clientUuid'
import { isNetworkError } from '@/offline/isNetworkError'
import { markOffline } from '@/offline/networkGuard'
import {
  RECURRING_CREATE_KEY,
  RECURRING_UPDATE_KEY,
  RECURRING_DELETE_KEY,
  RECURRING_TOGGLE_KEY,
} from '@/offline/mutationDefaults'
import {
  applyOptimisticRecurringCreate,
  applyOptimisticRecurringUpdate,
  buildPendingRecurringRow,
  clearOptimisticRecurring,
  findRecurringInCache,
  removeRecurringFromCache,
  restoreRecurringRow,
  serializeRecurringPayload,
} from '@/offline/optimisticRecurring'

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
  const requeueGuardRef = useRef(new Set())
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

  // Al abrir Finanzas: materializa vencidos una vez por montaje (solo online).
  useEffect(() => {
    if (!userId || !businessId || businessLoading || !canCreate || generatedRef.current) return
    if (!onlineManager.isOnline()) return
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

  const createMutation = useMutation({
    mutationKey: RECURRING_CREATE_KEY,
    onMutate: async (vars) => {
      const payload = vars?.payload || {}
      const clientUuid = payload.client_uuid
      const contactName = contacts?.find((c) => String(c.id) === String(payload.contact_id))?.name
      if (clientUuid && !requeueGuardRef.current.has(clientUuid)) {
        applyOptimisticRecurringCreate(
          queryClient,
          buildPendingRecurringRow(payload, { userId, businessId, contactName }),
        )
      }
      setModalOpen(false)
      setSelected(null)
      if (!onlineManager.isOnline()) notifyOfflineQueued('Repetición')
      return { clientUuid }
    },
    onSuccess: (_d, _v, ctx) => {
      if (ctx?.clientUuid) requeueGuardRef.current.delete(ctx.clientUuid)
      if (onlineManager.isOnline()) notify.success('Repetición creada')
      invalidateFinance()
    },
    onError: (error, vars, ctx) => {
      const uuid = ctx?.clientUuid || vars?.payload?.client_uuid
      if (isNetworkError(error)) {
        markOffline()
        notifyOfflineQueued('Repetición')
        if (uuid && !requeueGuardRef.current.has(uuid)) {
          requeueGuardRef.current.add(uuid)
          queueMicrotask(() => createMutation.mutate(vars))
        }
        return
      }
      if (uuid) requeueGuardRef.current.delete(uuid)
      clearOptimisticRecurring(queryClient, uuid)
      notify.error(getSupabaseErrorMessage(error))
    },
  })

  const updateMutation = useMutation({
    mutationKey: RECURRING_UPDATE_KEY,
    onMutate: async (vars) => {
      const id = vars?.id
      const previous = findRecurringInCache(queryClient, id)
      if (previous && !requeueGuardRef.current.has(`rec-upd-${id}`)) {
        applyOptimisticRecurringUpdate(queryClient, id, vars?.payload || {})
      }
      setModalOpen(false)
      setSelected(null)
      if (!onlineManager.isOnline()) notifyOfflineQueued('Repetición')
      return { id, previous }
    },
    onSuccess: (_d, _v, ctx) => {
      if (ctx?.id != null) requeueGuardRef.current.delete(`rec-upd-${ctx.id}`)
      if (onlineManager.isOnline()) notify.success('Repetición actualizada')
      invalidateFinance()
    },
    onError: (error, vars, ctx) => {
      const id = ctx?.id ?? vars?.id
      const key = `rec-upd-${id}`
      if (isNetworkError(error)) {
        markOffline()
        notifyOfflineQueued('Repetición')
        if (id != null && !requeueGuardRef.current.has(key)) {
          requeueGuardRef.current.add(key)
          queueMicrotask(() => updateMutation.mutate(vars))
        }
        return
      }
      requeueGuardRef.current.delete(key)
      restoreRecurringRow(queryClient, id, ctx?.previous)
      notify.error(getSupabaseErrorMessage(error))
    },
  })

  const toggleMutation = useMutation({
    mutationKey: RECURRING_TOGGLE_KEY,
    onMutate: async (vars) => {
      const id = vars?.id
      const previous = findRecurringInCache(queryClient, id)
      if (previous && !requeueGuardRef.current.has(`rec-tog-${id}`)) {
        applyOptimisticRecurringUpdate(queryClient, id, { is_active: vars.is_active })
      }
      if (!onlineManager.isOnline()) notifyOfflineQueued('Repetición')
      return { id, previous }
    },
    onSuccess: (_d, vars, ctx) => {
      if (ctx?.id != null) requeueGuardRef.current.delete(`rec-tog-${ctx.id}`)
      if (onlineManager.isOnline()) {
        notify.success(vars.is_active ? 'Repetición activada' : 'Repetición pausada')
      }
      invalidateFinance()
    },
    onError: (error, vars, ctx) => {
      const id = ctx?.id ?? vars?.id
      const key = `rec-tog-${id}`
      if (isNetworkError(error)) {
        markOffline()
        notifyOfflineQueued('Repetición')
        if (id != null && !requeueGuardRef.current.has(key)) {
          requeueGuardRef.current.add(key)
          queueMicrotask(() => toggleMutation.mutate(vars))
        }
        return
      }
      requeueGuardRef.current.delete(key)
      restoreRecurringRow(queryClient, id, ctx?.previous)
      notify.error(getSupabaseErrorMessage(error))
    },
  })

  const deleteMutation = useMutation({
    mutationKey: RECURRING_DELETE_KEY,
    onMutate: async (vars) => {
      const id = vars?.id
      const previous = findRecurringInCache(queryClient, id)
      if (id != null && !requeueGuardRef.current.has(`rec-del-${id}`)) {
        removeRecurringFromCache(queryClient, id)
      }
      setDeleteId(null)
      if (!onlineManager.isOnline()) notifyOfflineQueued('Repetición')
      return { id, previous }
    },
    onSuccess: (_d, _v, ctx) => {
      if (ctx?.id != null) requeueGuardRef.current.delete(`rec-del-${ctx.id}`)
      if (onlineManager.isOnline()) notify.success('Repetición eliminada')
      invalidateFinance()
    },
    onError: (error, vars, ctx) => {
      const id = ctx?.id ?? vars?.id
      const key = `rec-del-${id}`
      if (isNetworkError(error)) {
        markOffline()
        notifyOfflineQueued('Repetición')
        if (id != null && !requeueGuardRef.current.has(key)) {
          requeueGuardRef.current.add(key)
          queueMicrotask(() => deleteMutation.mutate(vars))
        }
        return
      }
      requeueGuardRef.current.delete(key)
      if (ctx?.previous) {
        applyOptimisticRecurringCreate(queryClient, { ...ctx.previous, _pending: false })
      }
      notify.error(getSupabaseErrorMessage(error))
    },
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
    if (item?._pending || String(item?.id).startsWith('pending-')) {
      notify.info('Esta repetición aún no se ha subido. Espera a que se sincronice para editarla.')
      return
    }
    setSelected(item)
    setModalOpen(true)
  }

  const handleSubmit = (raw) => {
    if (raw?.contact_id != null && String(raw.contact_id).startsWith('pending-')) {
      notify.warning('El contacto aún no se ha sincronizado. Elige otro o espera a reconectar.')
      return
    }

    const payload = serializeRecurringPayload(raw)

    if (raw?.id && !String(raw.id).startsWith('pending-')) {
      updateMutation.mutate({ id: raw.id, payload, userId, businessId })
      return
    }

    if (!payload.client_uuid) payload.client_uuid = genClientUuid()
    createMutation.mutate({ payload, userId, businessId })
  }

  const handleRunNow = (item) => {
    if (!onlineManager.isOnline()) {
      notify.warning('Sin conexión no se puede registrar ahora. Reconecta e inténtalo de nuevo.')
      return
    }
    if (item?._pending || String(item?.id).startsWith('pending-')) {
      notify.info('Esta repetición aún no se ha subido.')
      return
    }
    runNowMutation.mutate(item.id)
  }

  const submitting = createMutation.isPending || updateMutation.isPending

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
            <div className="space-y-3" role="status" aria-label="Cargando repeticiones">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="rounded-lg border p-3 sm:p-4 space-y-3">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-56" />
                  <Skeleton className="h-8 w-24" />
                </div>
              ))}
            </div>
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
                const pending = Boolean(item._pending) || String(item.id).startsWith('pending-')
                return (
                  <PendingSyncRow key={item.id} pending={pending} className={!item.is_active && !pending ? 'opacity-70' : undefined}>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between w-full">
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
                              disabled={pending || !item.is_active || runNowMutation.isPending}
                              onClick={() => handleRunNow(item)}
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
                              disabled={pending}
                              onClick={() => toggleMutation.mutate({
                                id: item.id,
                                is_active: !item.is_active,
                                userId,
                                businessId,
                              })}
                            >
                              {item.is_active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              title="Editar"
                              disabled={pending}
                              onClick={() => openEdit(item)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </PermissionGuard>
                          <PermissionGuard permission="finanzas.delete">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              title="Eliminar"
                              disabled={pending}
                              onClick={() => setDeleteId(item.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </PermissionGuard>
                        </div>
                      </div>
                    </div>
                  </PendingSyncRow>
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
        onSubmit={handleSubmit}
        item={selected}
        categories={categories}
        paymentMethods={paymentMethods}
        currencies={currencies}
        contacts={contacts}
        submitting={submitting}
      />

      <ConfirmDialog
        open={Boolean(deleteId)}
        onOpenChange={(o) => { if (!o) setDeleteId(null) }}
        title="¿Eliminar esta repetición?"
        description="Los movimientos que ya se anotaron se quedan. Solo dejas de repetir este en el futuro."
        confirmText="Eliminar"
        cancelText="Cancelar"
        tone="destructive"
        onConfirm={() => deleteMutation.mutate({ id: deleteId, userId, businessId })}
      />
    </>
  )
}
