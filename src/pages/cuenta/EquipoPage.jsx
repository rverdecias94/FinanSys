import { useMemo, useState } from 'react'
import { Users, Shield, Lock, AlertTriangle } from 'lucide-react'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SectionSwitcher } from '@/components/navigation/SectionSwitcher'
import { PlanRoleSummary } from '@/components/common/PlanRoleSummary'
import { TeamManagement } from '@/components/config/TeamManagement'
import { RoleManagement } from '@/components/config/RoleManagement'
import { PremiumFeatureScreen } from '@/components/auth/PremiumFeatureScreen'
import { usePermissionCheck } from '@/components/common/PermissionGuard'
import { useSubscription } from '@/context/SubscriptionContext'
import { isPaidPlanId } from '@/lib/plans'

export default function EquipoPage() {
  const { canView, isOwner, hasPermission } = usePermissionCheck()
  const { subscription } = useSubscription()
  const isPaid = isPaidPlanId(subscription?.plan_id)
  const canManageTeam = isOwner || hasPermission('team.manage')

  const sections = useMemo(
    () => [
      { value: 'miembros', label: 'Miembros', icon: Users },
      { value: 'roles', label: 'Roles', icon: Shield },
    ],
    [],
  )
  const [section, setSection] = useState('miembros')

  if (!canView('config') || !canManageTeam) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Card className="max-w-md p-6 text-center">
          <CardContent className="space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <Lock className="h-8 w-8" />
            </div>
            <div>
              <h3 className="mb-2 text-lg font-semibold">Acceso restringido</h3>
              <p className="text-muted-foreground">
                No tienes permisos para gestionar el equipo.
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
            <Users className="h-8 w-8 text-primary" />
          </div>
          Equipo
        </h1>
        <PlanRoleSummary className="sm:justify-end" />
      </div>

      {!isOwner && (
        <Card className="border-border bg-muted/30">
          <CardHeader>
            <CardTitle className="flex shrink-0 items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Vista de solo lectura
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Estás viendo el equipo en modo de solo lectura. Contacta al propietario si necesitas cambios.
            </p>
          </CardContent>
        </Card>
      )}

      <Tabs value={section} onValueChange={setSection} className="space-y-4">
        <SectionSwitcher
          value={section}
          onValueChange={setSection}
          options={sections}
          label="Sección"
        />

        <TabsContent value="miembros" className="space-y-4">
          {isPaid ? (
            <TeamManagement />
          ) : (
            <PremiumFeatureScreen
              icon={Users}
              title="La gestión de equipo está en Negocio y Élite"
              description="Invita colaboradores a tu negocio, asígnales roles y trabajen juntos con permisos controlados y registro de auditoría."
              ctaHint="Pasa a Negocio o Élite para activar tu equipo."
            />
          )}
        </TabsContent>

        <TabsContent value="roles" className="space-y-4">
          {isPaid ? (
            <RoleManagement />
          ) : (
            <PremiumFeatureScreen
              icon={Shield}
              title="Los roles personalizados están en Negocio y Élite"
              description="Crea roles a la medida (Editor, Consultor o los tuyos) y define con precisión qué puede ver y hacer cada miembro."
              ctaHint="Disponible al pasar a Negocio o Élite."
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
