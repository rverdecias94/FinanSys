import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'

export function DowngradeTeamStep({ members }) {
  const affected = (members || []).filter((m) => ['active', 'pending'].includes(m?.status))

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Los usuarios de tu equipo dejarán de tener acceso a este negocio. Sus cuentas no se eliminarán, pero ya no podrán entrar ni modificar información de tu empresa.
      </p>

      <div className="rounded-md border p-3">
        <div className="text-sm font-medium">Miembros de equipo afectados</div>
        <div className="mt-2 text-sm text-muted-foreground">{affected.length} usuarios perderán acceso</div>
        <div className="mt-3">
          <ScrollArea className="h-[180px] rounded-md border">
            <div className="divide-y">
              {affected.length === 0 ? (
                <div className="p-3 text-sm text-muted-foreground">No hay miembros de equipo activos o pendientes.</div>
              ) : (
                affected.map((m) => (
                  <div key={m.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{m.member_email}</div>
                      <div className="truncate text-xs text-muted-foreground">Rol: {m.roles?.name || '—'} · Estado: {m.status}</div>
                    </div>
                    <Badge variant="secondary">Acceso revocado</Badge>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  )
}

