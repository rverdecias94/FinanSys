import { useEffect, useState } from 'react'
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useSession } from '@/hooks/useSession'
import { useBusiness } from '@/context/BusinessContext'
import { Button } from '@/components/ui/button'
import { Wallet, Settings, LogOut, Menu, X, ChartArea, Warehouse, Layers, FileText, ShieldAlert, Shield, ShieldCheck } from 'lucide-react'
import { supabase } from '@/config/supabase'
import { useSubscription } from '@/context/SubscriptionContext'
import PermissionGuard from '@/components/SubscriptionGuard' // Actually PermissionGuard
import { isSystemAdmin } from '@/services/planRequests'

export default function SidebarLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { subscription } = useSubscription()
  const { session } = useSession()
  const { isOwner, roleName, roleId } = useBusiness()
  const email = session?.user?.email || 'Usuario Local'
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const isAdminQuery = useQuery({
    queryKey: ['isSystemAdmin'],
    queryFn: isSystemAdmin,
    enabled: !!session,
    staleTime: 5 * 60 * 1000
  })

  useEffect(() => {
    setSidebarOpen(false)
  }, [location.pathname])

  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  const linkClass = ({ isActive }) =>
    `flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${isActive ? 'bg-primary text-primary-foreground' : 'hover:bg-accent hover:text-accent-foreground text-muted-foreground'}`

  return (
    <div className="h-screen lg:grid lg:grid-cols-[240px_1fr] lg:overflow-hidden bg-background">
      {/* Mobile Sidebar Overlay */}
      <div
        className={`fixed inset-0 z-40 bg-black/50 transition-opacity lg:hidden ${sidebarOpen ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        onClick={() => setSidebarOpen(false)}
      />

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 -translate-x-full border-r bg-card p-4 flex flex-col transition-transform lg:translate-x-0 lg:static lg:h-screen lg:w-auto ${sidebarOpen ? 'translate-x-0' : ''}`}
      >
        <div className="mb-6 flex items-center justify-between">
          <div className="flex font-bold text-xl">
            <div className="flex items-center">
              <img src="/logo.png" alt="Logo" className="h-20 w-40 object-contain" />
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        <nav className="space-y-1 flex-1">
          <NavLink to="/" className={linkClass}>
            <ChartArea className="w-4 h-4" />
            <span>Panel General</span>
          </NavLink>

          <PermissionGuard requiredPermission="finanzas.view">
            <NavLink to="/finanzas" className={linkClass}>
              <Wallet className="w-4 h-4" />
              <span>Finanzas</span>
            </NavLink>
          </PermissionGuard>

          <PermissionGuard requiredPermission="warehouse.view">
            <NavLink to="/almacen" className={linkClass}>
              <Warehouse className="w-4 h-4" />
              <span>Almacén</span>
            </NavLink>
          </PermissionGuard>

          <PermissionGuard requiredPermission="inventory.view">
            <NavLink to="/inventario" className={linkClass}>
              <Layers className="w-4 h-4" />
              <span>Inventario</span>
            </NavLink>
          </PermissionGuard>

          <PermissionGuard requiredPermission="reports.view">
            <NavLink to="/reportes" className={linkClass}>
              <FileText className="w-4 h-4" />
              <span>Reportes</span>
            </NavLink>
          </PermissionGuard>

          <PermissionGuard requiredPermission="logs.view">
            <NavLink to="/logs" className={linkClass}>
              <ShieldAlert className="w-4 h-4" />
              <span>Auditoría</span>
            </NavLink>
          </PermissionGuard>

          <PermissionGuard requiredPermission="config.view">
            <NavLink to="/configuracion" className={linkClass}>
              <Settings className="w-4 h-4" />
              <span>Configuración</span>
            </NavLink>
          </PermissionGuard>

          {isAdminQuery.data && (
            <NavLink to="/admin/planes" className={linkClass}>
              <ShieldCheck className="w-4 h-4" />
              <span>Admin Planes</span>
            </NavLink>
          )}
        </nav>

        <div className="mt-auto pt-4 border-t space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="text-sm font-medium truncate max-w-[120px]" title={email}>
                {email}
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={handleLogout} className="h-8 w-8">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>

          {isOwner && (
            <div className="flex flex-col gap-2">
              {subscription?.plan_id === 'premium' && (
                <div className="text-xs font-semibold px-2 py-1 rounded text-center bg-primary/10 text-primary">
                  Plan Premium
                </div>
              )}
              {subscription?.plan_id !== 'premium' && (
                <>
                  <div className="text-xs font-semibold px-2 py-1 rounded text-center bg-muted text-muted-foreground">
                    Plan Gratuito
                  </div>
                  <Button
                    variant="default"
                    size="sm"
                    className="w-full text-xs font-bold uppercase bg-primary/70"
                    onClick={() => navigate('/configuracion')}
                  >
                    MEJORAR PLAN
                  </Button>
                </>
              )}
            </div>
          )}

          {!isOwner && (roleName || roleId) && (
            <div className="flex items-center justify-center gap-1.5 text-xs font-semibold px-2 py-1.5 rounded text-center bg-blue-500/10 text-blue-700 dark:text-blue-300">
              <Shield className="h-3.5 w-3.5 shrink-0" />
              <span>{roleName || 'Miembro'}</span>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex flex-col h-screen overflow-hidden">
        {/* Mobile Header */}
        <header className="sticky top-0 z-30 flex items-center border-b bg-background px-4 py-3 lg:hidden">
          <img src="/logo.png" alt="Logo" className="h-8 w-auto object-contain" />
          <div className="ml-auto flex items-center gap-2">
            <span className="text-sm font-semibold">Menú</span>
            <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)}>
              <Menu className="w-5 h-5" />
            </Button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
