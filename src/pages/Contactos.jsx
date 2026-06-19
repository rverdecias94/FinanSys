import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Users, Plus, Pencil, Trash2, Phone, Mail, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ResponsiveListing } from '@/components/common/ResponsiveListing'
import { ContactModal } from '@/components/contactos/ContactModal'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useSession } from '@/hooks/useSession'
import { useBusiness } from '@/context/BusinessContext'
import { usePermissionCheck, PermissionGuard, ActionButtons } from '@/components/common/PermissionGuard'
import { listContacts, createContact, updateContact, deleteContact } from '@/services/contacts'
import { notify, getSupabaseErrorMessage } from '@/services/notifications'

const KIND_LABEL = { cliente: 'Cliente', proveedor: 'Proveedor', ambos: 'Ambos' }

export default function Contactos() {
  const { session } = useSession()
  const { businessId, loading: businessLoading } = useBusiness()
  const { canView, loading: permissionLoading } = usePermissionCheck()
  const qc = useQueryClient()
  const userId = session?.user?.id

  const [search, setSearch] = useState('')
  const [kind, setKind] = useState('all')
  const [totalCount, setTotalCount] = useState(0)

  const [modalOpen, setModalOpen] = useState(false)
  const [selected, setSelected] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)

  const invalidate = () => qc.invalidateQueries({ queryKey: ['contacts'] })

  const createMutation = useMutation({
    mutationFn: (payload) => createContact(payload, userId, businessId),
    onSuccess: () => { invalidate(); setModalOpen(false); setSelected(null) },
    onError: (e) => notify.error(getSupabaseErrorMessage(e))
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, ...payload }) => updateContact(id, payload, userId, businessId),
    onSuccess: () => { invalidate(); setModalOpen(false); setSelected(null) },
    onError: (e) => notify.error(getSupabaseErrorMessage(e))
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => deleteContact(id, userId, businessId),
    onSuccess: () => { invalidate(); setDeleteTarget(null) },
    onError: (e) => notify.error(getSupabaseErrorMessage(e))
  })

  const handleCreate = () => { setSelected(null); setModalOpen(true) }
  const handleEdit = (contact) => { setSelected(contact); setModalOpen(true) }
  const handleSubmit = (payload) => {
    if (selected?.id) updateMutation.mutate({ id: selected.id, ...payload })
    else createMutation.mutate(payload)
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
      {/* Header */}
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

      {/* Filtros */}
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

      {/* Listado */}
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
              <div className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
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
                      <Button variant="ghost" size="sm" action="edit" onClick={() => handleEdit(c)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" action="delete" onClick={() => setDeleteTarget(c)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </ActionButtons>
                  </div>
                </div>
              </div>
            )}
          />
        </CardContent>
      </Card>

      <ContactModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        contact={selected}
        onSubmit={handleSubmit}
        submitting={createMutation.isPending || updateMutation.isPending}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => { if (!o) setDeleteTarget(null) }}
        title="Eliminar contacto"
        description={`¿Seguro que quieres eliminar a “${deleteTarget?.name}”? Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        tone="destructive"
        loading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate(deleteTarget.id)}
      />
    </div>
  )
}
