import { Lock, AlertTriangle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PlanRoleSummary } from '@/components/common/PlanRoleSummary'
import { usePermissionCheck } from '@/components/common/PermissionGuard'
import { useBusiness } from '@/context/BusinessContext'

/**
 * Cabecera común + control de acceso para rutas /cuenta/*.
 */
export function CuentaPageShell({ title, icon: Icon, children, requireOwner = false }) {
  const { canView, isOwner } = usePermissionCheck()
  const { isOwner: businessOwner } = useBusiness()
  const owner = isOwner ?? businessOwner

  if (!canView('config') || (requireOwner && !owner)) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Card className="max-w-md p-6 text-center">
          <CardContent className="space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <Lock className="h-8 w-8" />
            </div>
            <div>
              <h3 className="mb-2 text-lg font-semibold">Acceso restringido</h3>
              <p className="mb-4 text-muted-foreground">
                {requireOwner && !owner
                  ? 'Solo el propietario puede gestionar el plan.'
                  : 'No tienes permisos para acceder a esta sección.'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="flex items-center gap-3 text-2xl font-bold tracking-tight sm:text-3xl">
          <div className="rounded-lg bg-primary/10 p-2">
            <Icon className="h-8 w-8 text-primary" />
          </div>
          {title}
        </h1>
        <PlanRoleSummary className="sm:justify-end" />
      </div>

      {!owner && (
        <Card className="border-border bg-muted/30">
          <CardHeader>
            <CardTitle className="flex shrink-0 items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Vista de solo lectura
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Estás viendo esta sección en modo de solo lectura. Contacta al propietario del negocio si necesitas realizar cambios.
            </p>
          </CardContent>
        </Card>
      )}

      {children}
    </div>
  )
}
