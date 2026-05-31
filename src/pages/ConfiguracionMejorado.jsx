import { useState } from 'react'
import { 
  Settings, 
  Users, 
  DollarSign, 
  Shield, 
  AlertTriangle,
  Eye,
  Edit3,
  Lock,
  UserCheck,
  Key,
  Mail,
  Bell,
  Palette,
  Globe
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useSession } from '@/hooks/useSession'
import { useBusiness } from '@/context/BusinessContext'
import { PermissionGuard, usePermissionCheck } from '@/components/common/PermissionGuard'
import { DashboardPermissions, PermissionSummary } from '@/components/dashboard/DashboardPermissions'

export default function ConfiguracionMejorado() {
  const { session } = useSession()
  const { businessId } = useBusiness()
  const { canView, canEdit, isOwner, loading } = usePermissionCheck()

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
        <PermissionSummary compact />
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
      <Tabs defaultValue="general" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 lg:grid-cols-5">
          <TabsTrigger value="general" className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            General
          </TabsTrigger>
          <TabsTrigger value="moneda" className="flex items-center gap-2">
            <DollarSign className="w-4 h-4" />
            Moneda
          </TabsTrigger>
          <TabsTrigger value="equipo" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Equipo
          </TabsTrigger>
          <TabsTrigger value="permisos" className="flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Permisos
          </TabsTrigger>
          <TabsTrigger value="notificaciones" className="flex items-center gap-2">
            <Bell className="w-4 h-4" />
            Notificaciones
          </TabsTrigger>
        </TabsList>

        {/* Tab General */}
        <TabsContent value="general" className="space-y-4">
          <PermissionGuard 
            permission="config.edit" 
            mode="readonly"
            fallback={
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="w-5 h-5" />
                    Configuración General
                    <Badge variant="secondary">Solo Lectura</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="p-4 bg-gray-50 rounded-lg border">
                      <div className="flex items-center gap-2 mb-2">
                        <Eye className="w-4 h-4 text-gray-600" />
                        <span className="font-medium text-gray-800">Información de la Empresa</span>
                      </div>
                      <p className="text-sm text-gray-600">
                        Puedes ver la configuración actual de la empresa, pero no puedes modificarla.
                      </p>
                    </div>
                    
                    <div className="p-4 bg-gray-50 rounded-lg border">
                      <div className="flex items-center gap-2 mb-2">
                        <Lock className="w-4 h-4 text-gray-600" />
                        <span className="font-medium text-gray-800">Configuración del Sistema</span>
                      </div>
                      <p className="text-sm text-gray-600">
                        Los ajustes del sistema están bloqueados para tu rol actual.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            }
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  Configuración General
                  {isOwner && <Badge variant="default">Acceso Total</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Nombre de la Empresa</label>
                    <input 
                      type="text" 
                      className="w-full px-3 py-2 border rounded-md bg-background"
                      placeholder="Nombre de tu empresa"
                      disabled={!canEdit('config')}
                    />
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium mb-2 block">Descripción</label>
                    <textarea 
                      className="w-full px-3 py-2 border rounded-md bg-background min-h-[100px]"
                      placeholder="Descripción de tu empresa"
                      disabled={!canEdit('config')}
                    />
                  </div>
                  
                  <div className="flex justify-end">
                    <Button disabled={!canEdit('config')}>
                      Guardar Cambios
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </PermissionGuard>
        </TabsContent>

        {/* Tab Moneda */}
        <TabsContent value="moneda" className="space-y-4">
          <PermissionGuard 
            permission="config.edit" 
            mode="readonly"
            fallback={
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="w-5 h-5" />
                    Configuración de Moneda
                    <Badge variant="secondary">Solo Lectura</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="p-4 bg-gray-50 rounded-lg border">
                      <div className="flex items-center gap-2 mb-2">
                        <Eye className="w-4 h-4 text-gray-600" />
                        <span className="font-medium text-gray-800">Monedas Configuradas</span>
                      </div>
                      <p className="text-sm text-gray-600">
                        Puedes ver las monedas configuradas en el sistema, pero no puedes modificarlas.
                      </p>
                    </div>
                    
                    <div className="p-4 bg-gray-50 rounded-lg border">
                      <div className="flex items-center gap-2 mb-2">
                        <Globe className="w-4 h-4 text-gray-600" />
                        <span className="font-medium text-gray-800">Divisas y Tasas</span>
                      </div>
                      <p className="text-sm text-gray-600">
                        La configuración de divisas está restringida para tu rol actual.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            }
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5" />
                  Configuración de Moneda
                  {isOwner && <Badge variant="default">Acceso Total</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Moneda Principal</label>
                    <select className="w-full px-3 py-2 border rounded-md bg-background" disabled={!canEdit('config')}>
                      <option value="USD">USD - Dólar Americano</option>
                      <option value="CUP">CUP - Peso Cubano</option>
                      <option value="EUR">EUR - Euro</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium mb-2 block">Monedas Adicionales</label>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <input type="checkbox" id="cup" disabled={!canEdit('config')} />
                        <label htmlFor="cup" className="text-sm">CUP - Peso Cubano</label>
                      </div>
                      <div className="flex items-center gap-2">
                        <input type="checkbox" id="eur" disabled={!canEdit('config')} />
                        <label htmlFor="eur" className="text-sm">EUR - Euro</label>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex justify-end">
                    <Button disabled={!canEdit('config')}>
                      Guardar Cambios
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </PermissionGuard>
        </TabsContent>

        {/* Tab Equipo */}
        <TabsContent value="equipo" className="space-y-4">
          <PermissionGuard 
            permission="team.manage" 
            mode="readonly"
            fallback={
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    Gestión de Equipo
                    <Badge variant="secondary">Solo Lectura</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="p-4 bg-gray-50 rounded-lg border">
                      <div className="flex items-center gap-2 mb-2">
                        <Eye className="w-4 h-4 text-gray-600" />
                        <span className="font-medium text-gray-800">Miembros del Equipo</span>
                      </div>
                      <p className="text-sm text-gray-600">
                        Puedes ver los miembros del equipo, pero no puedes gestionarlos.
                      </p>
                    </div>
                    
                    <div className="p-4 bg-gray-50 rounded-lg border">
                      <div className="flex items-center gap-2 mb-2">
                        <Mail className="w-4 h-4 text-gray-600" />
                        <span className="font-medium text-gray-800">Invitaciones</span>
                      </div>
                      <p className="text-sm text-gray-600">
                        No puedes enviar invitaciones ni gestionar roles de otros usuarios.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            }
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Gestión de Equipo
                  {isOwner && <Badge variant="default">Acceso Total</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <h4 className="font-medium">Invitar Nuevos Miembros</h4>
                      <p className="text-sm text-muted-foreground">
                        Agrega nuevos miembros a tu equipo de trabajo
                      </p>
                    </div>
                    <Button disabled={!canEdit('team')}>
                      <Users className="w-4 h-4 mr-2" />
                      Invitar Miembro
                    </Button>
                  </div>
                  
                  <div>
                    <h4 className="font-medium mb-2">Miembros Actuales</h4>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                            <UserCheck className="w-4 h-4 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">Tú (Propietario)</p>
                            <p className="text-sm text-muted-foreground">Acceso completo</p>
                          </div>
                        </div>
                        <Badge variant="default">Propietario</Badge>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </PermissionGuard>
        </TabsContent>

        {/* Tab Permisos */}
        <TabsContent value="permisos" className="space-y-4">
          <DashboardPermissions />
        </TabsContent>

        {/* Tab Notificaciones */}
        <TabsContent value="notificaciones" className="space-y-4">
          <PermissionGuard 
            permission="config.edit" 
            mode="readonly"
            fallback={
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bell className="w-5 h-5" />
                    Configuración de Notificaciones
                    <Badge variant="secondary">Solo Lectura</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="p-4 bg-gray-50 rounded-lg border">
                      <div className="flex items-center gap-2 mb-2">
                        <Eye className="w-4 h-4 text-gray-600" />
                        <span className="font-medium text-gray-800">Preferencias de Notificación</span>
                      </div>
                      <p className="text-sm text-gray-600">
                        Puedes ver las configuraciones de notificación, pero no puedes modificarlas.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            }
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="w-5 h-5" />
                  Configuración de Notificaciones
                  {isOwner && <Badge variant="default">Acceso Total</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">Notificaciones por Email</h4>
                      <p className="text-sm text-muted-foreground">
                        Recibe notificaciones importantes por correo electrónico
                      </p>
                    </div>
                    <input type="checkbox" className="toggle" disabled={!canEdit('config')} />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">Notificaciones en la Aplicación</h4>
                      <p className="text-sm text-muted-foreground">
                        Muestra notificaciones dentro de la aplicación
                      </p>
                    </div>
                    <input type="checkbox" className="toggle" disabled={!canEdit('config')} />
                  </div>
                  
                  <div className="flex justify-end">
                    <Button disabled={!canEdit('config')}>
                      Guardar Cambios
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </PermissionGuard>
        </TabsContent>
      </Tabs>
    </div>
  )
}