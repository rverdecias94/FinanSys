import { useRef, useState } from 'react'
import { useMutation, useQueryClient, onlineManager } from '@tanstack/react-query'
import { Users, Plus, Pencil, Trash2, Phone, Mail, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ResponsiveListing } from '@/components/common/ResponsiveListing'
import { PendingSyncRow } from '@/components/common/PendingSyncRow'
import { ContactModal } from '@/components/contactos/ContactModal'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useSession } from '@/hooks/useSession'
import { useBusiness } from '@/context/BusinessContext'
import { usePermissionCheck, PermissionGuard, ActionButtons } from '@/components/common/PermissionGuard'
import { listContacts } from '@/services/contacts'
import { notify, getSupabaseErrorMessage } from '@/services/notifications'
import { notifyOfflineQueued } from '@/services/notifyWrap'
import { genClientUuid } from '@/offline/clientUuid'
import { isNetworkError } from '@/offline/isNetworkError'
import { markOffline } from '@/offline/networkGuard'
import {
  CONTACT_CREATE_KEY,
  CONTACT_UPDATE_KEY,
  CONTACT_DELETE_KEY,
  serializeContactPayload,
} from '@/offline/mutationDefaults'
import {
  applyOptimisticContactCreate,
  applyOptimisticContactUpdate,
  buildPendingContactRow,
  clearOptimisticContact,
  findContactInCache,
  removeContactFromCache,
  restoreContactRow,
} from '@/offline/optimisticContacts'

const KIND_LABEL = { cliente: 'Cliente', proveedor: 'Proveedor', ambos: 'Ambos' }

export default function Contactos() {
  const { session } = useSession()
  const { businessId, loading: businessLoading } = useBusiness()
  const { canView, loading: permissionLoading } = usePermissionCheck()
  const qc = useQueryClient()
  const userId = session?.user?.id
  const requeueGuardRef = useRef(new Set())

  const [search, setSearch] = useState('')
  const [kind, setKind] = useState('all')
  const [totalCount, setTotalCount] = useState(0)

  const [modalOpen, setModalOpen] = useState(false)
  const [selected, setSelected] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)

  const invalidate = () => qc.invalidateQueries({ queryKey: ['contacts'] })

  const createMutation = useMutation({
    mutationKey: CONTACT_CREATE_KEY,
    onMutate: async (vars) => {
      const payload = vars?.payload || {}
      const clientUuid = payload.client_uuid
      if (clientUuid && !requeueGuardRef.current.has(clientUuid)) {
        applyOptimisticContactCreate(
          qc,
          buildPendingContactRow(payload, { userId, businessId }),
        )
      }
      setModalOpen(false)
      setSelected(null)
      if (!onlineManager.isOnline()) notifyOfflineQueued('Contacto')
      return { clientUuid }
    },
    onSuccess: (_data, vars, ctx) => {
      if (ctx?.clientUuid) requeueGuardRef.current.delete(ctx.clientUuid)
      invalidate()
    },
    onError: (error, vars, ctx) => {
      const uuid = ctx?.clientUuid || vars?.payload?.client_uuid
      if (isNetworkError(error)) {
        markOffline()
        notifyOfflineQueued('Contacto')
        if (uuid && !requeueGuardRef.current.has(uuid)) {
          requeueGuardRef.current.add(uuid)
          queueMicrotask(() => createMutation.mutate(vars))
        }
        return
      }
      if (uuid) requeueGuardRef.current.delete(uuid)
      clearOptimisticContact(qc, uuid)
      notify.error(getSupabaseErrorMessage(error))
    },
  })

  const updateMutation = useMutation({
    mutationKey: CONTACT_UPDATE_KEY,
    onMutate: async (vars) => {
      const id = vars?.id
      const previous = findContactInCache(qc, id)
      if (previous && !requeueGuardRef.current.has(`upd-${id}`)) {
        applyOptimisticContactUpdate(qc, id, vars?.payload || {})
      }
      setModalOpen(false)
      setSelected(null)
      if (!onlineManager.isOnline()) notifyOfflineQueued('Contacto')
      return { id, previous }
    },
    onSuccess: (_d, _v, ctx) => {
      if (ctx?.id != null) requeueGuardRef.current.delete(`upd-${ctx.id}`)
      invalidate()
    },
    onError: (error, vars, ctx) => {
      const id = ctx?.id ?? vars?.id
      const key = `upd-${id}`
      if (isNetworkError(error)) {
        markOffline()
        notifyOfflineQueued('Contacto')
        if (id != null && !requeueGuardRef.current.has(key)) {
          requeueGuardRef.current.add(key)
          queueMicrotask(() => updateMutation.mutate(vars))
        }
        return
      }
      requeueGuardRef.current.delete(key)
      restoreContactRow(qc, id, ctx?.previous)
      notify.error(getSupabaseErrorMessage(error))
    },
  })

  const deleteMutation = useMutation({
    mutationKey: CONTACT_DELETE_KEY,
    onMutate: async (vars) => {
      const id = vars?.id
      const previous = findContactInCache(qc, id)
      if (id != null && !requeueGuardRef.current.has(`del-${id}`)) {
        removeContactFromCache(qc, id)
      }
      setDeleteTarget(null)
      if (!onlineManager.isOnline()) notifyOfflineQueued('Contacto')
      return { id, previous }
    },
    onSuccess: (_d, _v, ctx) => {
      if (ctx?.id != null) requeueGuardRef.current.delete(`del-${ctx.id}`)
      invalidate()
    },
    onError: (error, vars, ctx) => {
      const id = ctx?.id ?? vars?.id
      const key = `del-${id}`
      if (isNetworkError(error)) {
        markOffline()
        notifyOfflineQueued('Contacto')
        if (id != null && !requeueGuardRef.current.has(key)) {
          requeueGuardRef.current.add(key)
          queueMicrotask(() => deleteMutation.mutate(vars))
        }
        return
      }
      requeueGuardRef.current.delete(key)
      if (ctx?.previous) {
        applyOptimisticContactCreate(qc, { ...ctx.previous, _pending: false })
      }
      notify.error(getSupabaseErrorMessage(error))
    },
  })

  const handleCreate = () => { setSelected(null); setModalOpen(true) }
  const handleEdit = (contact) => {
    if (contact?._pending) {
      notify.info('Este contacto aún no se ha subido. Espera a que se sincronice para editarlo.')
      return
    }
    setSelected(contact)
    setModalOpen(true)
  }
  const handleSubmit = (raw) => {
    const payload = serializeContactPayload(raw)
    if (selected?.id && !String(selected.id).startsWith('pending-')) {
      updateMutation.mutate({ id: selected.id, payload, userId, businessId })
      return
    }
    if (!payload.client_uuid) payload.client_uuid = genClientUuid()
    createMutation.mutate({ payload, userId, businessId })
  }

  if (!permissionLoading && !canView('finanzas')) {
    return (
      <div className="flex items-center justify-center h-96">
        <Card className="p-6 text-center">
          <CardContent>
            <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Acceso Restringido</h3>
            <p className="text-muted-foreground">No tienes permisos para acceder a Contactos.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const enabled = !!userId && !!businessId && !businessLoading && !permissionLoading

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Users className="w-8 h-8 text-primary" />
          </div>
          Contactos
        </h1>

        <PermissionGuard permission="finanzas.create">
          <Button onClick={handleCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Nuevo Contacto
          </Button>
        </PermissionGuard>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <div className="relative sm:col-span-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={kind} onValueChange={setKind}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Todos los tipos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los tipos</SelectItem>
            <SelectItem value="cliente">Clientes</SelectItem>
            <SelectItem value="proveedor">Proveedores</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Contactos</span>
            <Badge variant="secondary">{totalCount} registros</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveListing
            queryKey={['contacts', { businessId: businessId || userId, search, kind }]}
            queryFn={({ page, pageSize }) => listContacts({ page, pageSize, search, kind, userId, businessId })}
            enabled={enabled}
            onMeta={({ count }) => setTotalCount(count)}
            getItemKey={(c) => c.id}
            loadingMessage="Cargando contactos..."
            emptyMessage="No hay contactos. Crea el primero con “Nuevo Contacto”."
            renderItem={(c) => (
              <PendingSyncRow pending={Boolean(c._pending)}>
                <div className="flex min-w-0 items-start gap-3 sm:items-center">
                  <div className="shrink-0 rounded-full p-2 bg-primary/10">
                    <Users className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium break-words">{c.name}</div>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-sm text-muted-foreground">
                      {c.phone && (
                        <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{c.phone}</span>
                      )}
                      {c.email && (
                        <span className="flex min-w-0 items-center gap-1"><Mail className="h-3 w-3 shrink-0" /><span className="truncate">{c.email}</span></span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 border-t pt-3 sm:shrink-0 sm:justify-end sm:gap-4 sm:border-0 sm:pt-0">
                  <Badge variant="outline">{KIND_LABEL[c.kind] || c.kind}</Badge>
                  <div className="flex shrink-0 items-center gap-1">
                    <ActionButtons module="finanzas">
                      <Button
                        variant="ghost"
                        size="sm"
                        action="edit"
                        disabled={Boolean(c._pending)}
                        onClick={() => handleEdit(c)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        action="delete"
                        disabled={Boolean(c._pending)}
                        onClick={() => setDeleteTarget(c)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </ActionButtons>
                  </div>
                </div>
              </PendingSyncRow>
            )}
          />
        </CardContent>
      </Card>

      <ContactModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        contact={selected}
        onSubmit={handleSubmit}
        submitting={false}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => { if (!o) setDeleteTarget(null) }}
        title="Eliminar contacto"
        description={`¿Seguro que quieres eliminar a “${deleteTarget?.name}”? Dejará de aparecer en tus listas y el historial de movimientos asociado se conserva.`}
        confirmText="Eliminar"
        tone="destructive"
        loading={false}
        onConfirm={() => deleteMutation.mutate({ id: deleteTarget.id, userId, businessId })}
      />
    </div>
  )
}
