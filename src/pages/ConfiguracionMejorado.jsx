import { Settings, Users, Shield, AlertTriangle, Lock, Crown, Coins } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useSubscription } from '@/context/SubscriptionContext'
import { usePermissionCheck } from '@/components/common/PermissionGuard'
import { PermissionSummary } from '@/components/dashboard/DashboardPermissions'
import { TeamManagement } from '@/components/config/TeamManagement'
import { RoleManagement } from '@/components/config/RoleManagement'
import { PlansPanel } from '@/components/config/PlansPanel'
import { CurrenciesPanel } from '@/components/config/CurrenciesPanel'
import { GeneralSettingsPanel } from '@/components/config/GeneralSettingsPanel'

export default function ConfiguracionMejorado() {
  const { canView, isOwner, hasPermission } = usePermissionCheck()
  const { subscription } = useSubscription()

  const isPremium = subscription?.plan_id === 'premium'
  const canManageTeam = isOwner || hasPermission('team.manage')
  const showTeamTabs = canManageTeam && isPremium

  if (!canView('config')) {
    return (
      <div className="flex items-center justify-center h-96">
        <Card className="p-6 text-center max-w-md">
          <CardContent className="space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <Lock className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-2">Acceso Restringido</h3>
              <p className="text-muted-foreground mb-4">
                No tienes permisos para acceder a la configuración del sistema.
              </p>
              <div className="rounded-lg border bg-muted/40 p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 w-4 h-4 text-muted-foreground" />
                  <div className="text-sm">
                    <p className="font-medium">¿Por qué no puedo acceder?</p>
                    <p className="text-muted-foreground">
                      Solo los usuarios con rol de Propietario o permisos específicos pueden configurar el sistema.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Settings className="w-8 h-8 text-primary" />
          </div>
          Configuración
        </h1>

        <div className="flex items-center gap-3">
          <Badge variant="secondary" className="hidden sm:inline-flex">
            {isPremium ? (
              <span className="inline-flex items-center gap-2"><Crown className="h-3.5 w-3.5" /> Plan Premium</span>
            ) : (
              <span className="inline-flex items-center gap-2"><Coins className="h-3.5 w-3.5" /> Plan Gratuito</span>
            )}
          </Badge>
          <PermissionSummary compact />
        </div>
      </div>

      {!isOwner && (
        <Card className="border-border bg-muted/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Vista de Solo Lectura
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Estás viendo la configuración en modo de solo lectura. Contacta al propietario del negocio si necesitas realizar cambios.
            </p>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue={isOwner ? 'planes' : 'general'} className="space-y-4">
        <TabsList className="w-full overflow-x-auto flex gap-2 justify-start">
          {isOwner && (
            <TabsTrigger value="planes" className="flex items-center gap-2">
              <Crown className="w-4 h-4" />
              Planes
            </TabsTrigger>
          )}
          <TabsTrigger value="general" className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            General
          </TabsTrigger>
          <TabsTrigger value="monedas" className="flex items-center gap-2">
            <Coins className="w-4 h-4" />
            Monedas
          </TabsTrigger>
          {showTeamTabs && (
            <TabsTrigger value="equipo" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Equipo
            </TabsTrigger>
          )}
          {showTeamTabs && (
            <TabsTrigger value="roles" className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Roles
            </TabsTrigger>
          )}
        </TabsList>

        {isOwner && (
          <TabsContent value="planes" className="space-y-4">
            <PlansPanel />
          </TabsContent>
        )}

        <TabsContent value="general" className="space-y-4">
          <GeneralSettingsPanel />
        </TabsContent>

        <TabsContent value="monedas" className="space-y-4">
          <CurrenciesPanel />
        </TabsContent>

        {showTeamTabs && (
          <TabsContent value="equipo" className="space-y-4">
            <TeamManagement />
          </TabsContent>
        )}

        {showTeamTabs && (
          <TabsContent value="roles" className="space-y-4">
            <RoleManagement />
          </TabsContent>
        )}

      </Tabs>
    </div>
  )
}
