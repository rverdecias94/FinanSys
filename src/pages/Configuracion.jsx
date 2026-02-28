import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { getBalanceConfig, updateBalanceConfig } from '@/services/finanzas'
import { useSession } from '@/hooks/useSession'
import { useSubscription } from '@/context/SubscriptionContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Settings, Users, Crown, UserPlus, Trash2, CheckCircle2, Loader2 } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { supabase } from '@/config/supabase'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

export default function Configuracion() {
  const { session } = useSession()
  const { canAccessFeature, subscription, checkLimit, updatePlan } = useSubscription()
  const [initialBalanceUsd, setInitialBalanceUsd] = useState('')
  const [initialBalanceCup, setInitialBalanceCup] = useState('')
  const [currentBalanceUsd, setCurrentBalanceUsd] = useState('')
  const [currentBalanceCup, setCurrentBalanceCup] = useState('')
  const [savingBalance, setSavingBalance] = useState(false)
  const [loading, setLoading] = useState(true)

  // Team State
  const [members, setMembers] = useState([])
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteLoading, setInviteLoading] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [pendingMemberId, setPendingMemberId] = useState(null)
  const [planConfirmOpen, setPlanConfirmOpen] = useState(false)
  const [targetPlanId, setTargetPlanId] = useState(null)

  const saveBalance = async () => {
    if (!session?.user?.id) return
    setSavingBalance(true)
    try {
      const updatedConfig = await updateBalanceConfig(session.user.id, initialBalanceUsd, initialBalanceCup)
      if (updatedConfig) {
        setInitialBalanceUsd(updatedConfig.initial_usd)
        setInitialBalanceCup(updatedConfig.initial_cup)
        setCurrentBalanceUsd(updatedConfig.total_usd)
        setCurrentBalanceCup(updatedConfig.total_cup)
      }
    } catch (error) {
      console.error(error)
    } finally {
      setSavingBalance(false)
    }
  }

  const fetchMembers = async () => {
    if (!session?.user?.id) return
    const { data, error } = await supabase
      .from('team_members')
      .select('*')
      .eq('owner_id', session.user.id)

    if (error) console.error('Error fetching members:', error)
    else setMembers(data || [])
  }

  const handleInvite = async () => {
    // Check limit
    const limit = subscription?.plan_id === 'premium' ? 5 : 0
    if (members.length >= limit) {
      toast.error('Has alcanzado el límite de socios para tu plan.')
      return
    }

    if (!inviteEmail) return

    setInviteLoading(true)
    try {
      // Create invitation in team_member table
      const { data, error } = await supabase
        .from('team_members')
        .insert({
          owner_id: session.user.id,
          member_email: inviteEmail,
          role: 'editor',
          status: 'pending'
        })
        .select()
        .single()

      if (error) {
        // Handle specific RLS permission error
        if (error.code === '42501' || error.message?.includes('permission denied')) {
          console.error('RLS Permission error:', error)
          toast.error('Error de permisos al invitar socio. Contacta al administrador.', {
            description: 'Error: ' + error.message,
            duration: 5000
          })
          return
        }
        throw error
      }

      setMembers([...members, data])
      setInviteEmail('')
      toast.success(`Invitación enviada a ${inviteEmail}`)
    } catch (err) {
      console.error('Error inviting member:', err)
      toast.error('Error al invitar socio. Verifica que no esté ya invitado.')
    } finally {
      setInviteLoading(false)
    }
  }

  const handleDeleteMember = async (id) => {
    setPendingMemberId(id)
    setDeleteConfirmOpen(true)
  }

  const handlePlanChange = async (planId) => {
    if (planId === subscription?.plan_id) return

    setTargetPlanId(planId)
    setPlanConfirmOpen(true)
  }

  useEffect(() => {
    let mounted = true

    const loadData = async () => {
      if (session?.user?.id) {
        const balConfig = await getBalanceConfig(session.user.id)
        if (mounted && balConfig) {
          setInitialBalanceUsd(balConfig.initial_balance_usd || 0)
          setInitialBalanceCup(balConfig.initial_balance_cup || 0)
          setCurrentBalanceUsd(balConfig.balance_total_usd || 0)
          setCurrentBalanceCup(balConfig.balance_total_cup || 0)
        }

        if (mounted && canAccessFeature('partners')) {
          await fetchMembers()
        }
      }

      if (mounted) setLoading(false)
    }

    loadData()
    return () => { mounted = false }
  }, [session, subscription]) // Re-fetch if subscription changes (e.g. upgraded to premium -> fetch members)

  return (
    <div className="space-y-8 pb-20">
      <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-3">
        <div className="p-2 bg-primary/10 rounded-lg">
          <Settings className="w-8 h-8 text-primary" />
        </div>
        Configuración
      </h1>

      <Tabs defaultValue="billing" className="w-full max-w-7xl">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="billing">Planes y Facturación</TabsTrigger>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="team">Equipo y Socios</TabsTrigger>
        </TabsList>

        <TabsContent value="billing" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Free Plan */}
            <Card className={`relative flex flex-col ${subscription?.plan_id === 'free' ? 'border-primary shadow-md' : ''}`}>
              <CardHeader>
                <CardTitle className="flex justify-between items-center">
                  Plan Gratuito
                  {subscription?.plan_id === 'free' && <Badge>Actual</Badge>}
                </CardTitle>
                <CardDescription>Para empezar a organizar tu negocio</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 space-y-4">
                <div className="text-3xl font-bold">$0 <span className="text-sm font-normal text-muted-foreground">/ mes</span></div>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-500" /> 50 Transacciones / mes</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-500" /> 50 Productos</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-500" /> 5 Áreas de Inventario</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-500" /> Reportes Básicos (Solo lectura)</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-500" /> Sin Socios</li>
                </ul>
              </CardContent>
              <CardFooter>
                <Button
                  variant="outline"
                  className="w-full"
                  disabled={subscription?.plan_id === 'free'}
                  onClick={() => handlePlanChange('free')}
                >
                  {subscription?.plan_id === 'free' ? 'Plan Actual' : 'Cambiar a Gratuito'}
                </Button>
              </CardFooter>
            </Card>

            {/* Premium Plan */}
            <Card className={`relative flex flex-col border-yellow-400 ${subscription?.plan_id === 'premium' || subscription?.status === 'trial' ? 'bg-yellow-50/50 shadow-md' : ''}`}>
              {subscription?.status === 'trial' && (
                <div className="absolute -top-3 right-4 bg-yellow-500 text-white text-xs px-2 py-1 rounded-full font-bold shadow-sm">
                  Prueba Activa
                </div>
              )}
              <CardHeader>
                <CardTitle className="flex justify-between items-center text-yellow-700">
                  <div className="flex items-center gap-2">
                    <Crown className="w-5 h-5 fill-yellow-500 text-yellow-600" />
                    Plan Premium
                  </div>
                  {(subscription?.plan_id === 'premium' || subscription?.status === 'trial') && <Badge className="bg-yellow-500 hover:bg-yellow-600">Actual</Badge>}
                </CardTitle>
                <CardDescription>Para negocios en crecimiento sin límites</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 space-y-4">
                <div className="text-3xl font-bold">$5 <span className="text-sm font-normal text-muted-foreground">/ mes</span></div>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-yellow-600" /> Transacciones Ilimitadas</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-yellow-600" /> Productos Ilimitados</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-yellow-600" /> Áreas Ilimitadas</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-yellow-600" /> Reportes Avanzados + Exportación</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-yellow-600" /> Hasta 5 Socios</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-yellow-600" /> Logs de Auditoría</li>
                </ul>
              </CardContent>
              <CardFooter>
                {subscription?.plan_id === 'premium' ? (
                  <Button className="w-full" variant="outline" disabled>
                    Plan Activo
                  </Button>
                ) : (
                  <Button className="w-full bg-yellow-600 hover:bg-yellow-700 text-white" onClick={() => handlePlanChange('premium')}>
                    Suscribirse a Premium
                  </Button>
                )}
              </CardFooter>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="general" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Balance</CardTitle>
              <CardDescription>Gestiona el balance inicial y visualiza el actual</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">

              {/* Balance Inicial (Editable) */}
              <div className="space-y-4 border-b pb-6">
                <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">Balance Inicial (Manual)</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Inicial USD</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={initialBalanceUsd}
                      onChange={(e) => setInitialBalanceUsd(e.target.value)}
                      disabled={loading || savingBalance}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Inicial CUP</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={initialBalanceCup}
                      onChange={(e) => setInitialBalanceCup(e.target.value)}
                      disabled={loading || savingBalance}
                    />
                  </div>
                </div>
                <Button onClick={saveBalance} disabled={savingBalance}>
                  {savingBalance ? 'Guardando...' : 'Actualizar Balance Inicial'}
                </Button>
              </div>

              {/* Balance Actual (Read-only) */}
              <div className="space-y-4">
                <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">Balance Actual (Calculado)</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Actual USD</Label>
                    <Input
                      type="number"
                      value={currentBalanceUsd}
                      disabled={true}
                      className="bg-muted"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Actual CUP</Label>
                    <Input
                      type="number"
                      value={currentBalanceCup}
                      disabled={true}
                      className="bg-muted"
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  El balance actual se calcula automáticamente: Balance Inicial + Ingresos - Gastos.
                </p>
              </div>

            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="team" className="space-y-6 mt-6">
          {!canAccessFeature('partners') ? (
            <Alert className="bg-blue-50 border-blue-200">
              <Crown className="h-4 w-4 text-yellow-600 fill-yellow-400" />
              <AlertTitle className="text-blue-800">Función Premium</AlertTitle>
              <AlertDescription className="text-blue-700">
                Actualiza al plan Premium para agregar hasta 5 socios a tu equipo y gestionar permisos.
              </AlertDescription>
            </Alert>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Gestión de Equipo</CardTitle>
                <CardDescription>Invita a socios para colaborar en tu cuenta.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex gap-4 items-end">
                  <div className="space-y-2 flex-1">
                    <Label>Email del socio</Label>
                    <Input
                      placeholder="socio@ejemplo.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      disabled={inviteLoading}
                    />
                  </div>
                  <Button onClick={handleInvite} disabled={!inviteEmail || inviteLoading}>
                    {inviteLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
                    Invitar
                  </Button>
                </div>

                <div className="border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Email</TableHead>
                        <TableHead>Rol</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {members.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                            No hay socios invitados.
                          </TableCell>
                        </TableRow>
                      ) : (
                        members.map((m) => (
                          <TableRow key={m.id}>
                            <TableCell>{m.member_email}</TableCell>
                            <TableCell className="capitalize">{m.role}</TableCell>
                            <TableCell>
                              <Badge variant={m.status === 'active' ? 'default' : 'secondary'}>
                                {m.status === 'active' ? 'Activo' : 'Pendiente'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                onClick={() => handleDeleteMember(m.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={(o) => {
          setDeleteConfirmOpen(o)
          if (!o) setPendingMemberId(null)
        }}
        title="Confirmar eliminación de socio"
        description="¿Deseas eliminar este socio de tu equipo?"
        confirmText="Eliminar"
        cancelText="Cancelar"
        tone="destructive"
        onConfirm={async () => {
          if (!pendingMemberId) return
          try {
            const { error } = await supabase
              .from('team_members')
              .delete()
              .eq('id', pendingMemberId)
              .eq('owner_id', session.user.id)
            if (error) throw error
            setMembers(members.filter(m => m.id !== pendingMemberId))
            toast.success('Socio eliminado correctamente')
          } catch (err) {
            console.error('Error deleting member:', err)
            toast.error('Error al eliminar socio')
          } finally {
            setDeleteConfirmOpen(false)
            setPendingMemberId(null)
          }
        }}
      />
      <ConfirmDialog
        open={planConfirmOpen}
        onOpenChange={(o) => {
          setPlanConfirmOpen(o)
          if (!o) setTargetPlanId(null)
        }}
        title={targetPlanId === 'premium' ? 'Confirmar actualización a Premium' : 'Confirmar cambio a Gratuito'}
        description={targetPlanId === 'premium' ? 'Se aplicarán funciones Premium en tu cuenta.' : 'Se aplicarán restricciones del plan Gratuito.'}
        confirmText="Confirmar"
        cancelText="Cancelar"
        onConfirm={async () => {
          if (!targetPlanId) return
          await updatePlan(targetPlanId)
          setPlanConfirmOpen(false)
          setTargetPlanId(null)
        }}
      />
    </div>
  )
}
