import { Settings, Users, Shield, AlertTriangle, Lock, Crown, Coins } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useSubscription } from '@/context/SubscriptionContext'
import { usePermissionCheck } from '@/components/common/PermissionGuard'
import { DashboardPermissions, PermissionSummary } from '@/components/dashboard/DashboardPermissions'
import { TeamManagement } from '@/components/config/TeamManagement'
import { RoleManagement } from '@/components/config/RoleManagement'
import { PlansPanel } from '@/components/config/PlansPanel'
import { CurrenciesPanel } from '@/components/config/CurrenciesPanel'
import { GeneralSettingsPanel } from '@/components/config/GeneralSettingsPanel'

export default function ConfiguracionMejorado() {
  const { canView, isOwner } = usePermissionCheck()
  const { subscription } = useSubscription()

  // Si no tiene permisos de visualización, mostrar mensaje de acceso restringido
  if (!canView('config')) {
    return (
      <div className="flex items-center justify-center h-96">
        <Card className="p-6 text-center max-w-md">
          <CardContent className="space-y-4">
            <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
              <Lock className="w-8 h-8 text-red-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-2">Acceso Restringido</h3>
              <p className="text-muted-foreground mb-4">
                No tienes permisos para acceder a la configuración del sistema.
              </p>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-yellow-800">¿Por qué no puedo acceder?</p>
                    <p className="text-yellow-700">
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
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Settings className="w-8 h-8 text-primary" />
          </div>
          Configuración
        </h1>
        
        {/* Resumen de permisos actual */}
        <div className="flex items-center gap-3">
          <Badge variant="secondary" className="hidden sm:inline-flex">
            {subscription?.plan_id === 'premium' ? (
              <span className="inline-flex items-center gap-2"><Crown className="h-3.5 w-3.5" /> Plan Premium</span>
            ) : (
              <span className="inline-flex items-center gap-2"><Coins className="h-3.5 w-3.5" /> Plan Gratuito</span>
            )}
          </Badge>
          <PermissionSummary compact />
        </div>
      </div>

      {/* Mensaje de advertencia para usuarios no propietarios */}
      {!isOwner && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-yellow-800">
              <AlertTriangle className="w-5 h-5" />
              Vista de Solo Lectura
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-yellow-700 mb-3">
              Estás viendo la configuración en modo de solo lectura. Como usuario con permisos limitados, 
              puedes ver la configuración actual pero no puedes realizar cambios.
            </p>
            <div className="flex items-center gap-2 text-sm text-yellow-600">
              <UserCheck className="w-4 h-4" />
              <span>Contacta al propietario del negocio si necesitas realizar cambios en la configuración.</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs de configuración */}
      <Tabs defaultValue="planes" className="space-y-4">
        <TabsList className="w-full overflow-x-auto flex gap-2 justify-start">
          <TabsTrigger value="planes" className="flex items-center gap-2">
            <Crown className="w-4 h-4" />
            Planes
          </TabsTrigger>
          <TabsTrigger value="general" className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            General
          </TabsTrigger>
          <TabsTrigger value="monedas" className="flex items-center gap-2">
            <Coins className="w-4 h-4" />
            Monedas
          </TabsTrigger>
          <TabsTrigger value="equipo" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Equipo
          </TabsTrigger>
          <TabsTrigger value="roles" className="flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Roles
          </TabsTrigger>
          <TabsTrigger value="permisos" className="flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Permisos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="planes" className="space-y-4">
          <PlansPanel />
        </TabsContent>

        <TabsContent value="general" className="space-y-4">
          <GeneralSettingsPanel />
        </TabsContent>

        <TabsContent value="monedas" className="space-y-4">
          <CurrenciesPanel />
        </TabsContent>

        <TabsContent value="equipo" className="space-y-4">
          <TeamManagement />
        </TabsContent>

        <TabsContent value="roles" className="space-y-4">
          <RoleManagement />
        </TabsContent>

        <TabsContent value="permisos" className="space-y-4">
          <DashboardPermissions />
        </TabsContent>
      </Tabs>
    </div>
  )
}
