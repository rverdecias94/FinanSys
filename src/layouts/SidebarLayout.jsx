import { useEffect, useState } from 'react'
import { Outlet, NavLink, useLocation } from 'react-router-dom'
import { useSession } from '@/hooks/useSession'
import { useBusiness } from '@/context/BusinessContext'
import { Button } from '@/components/ui/button'
import { Wallet, Settings, LogOut, Menu, X, ChartArea, Warehouse, Layers, FileText, ShieldAlert, Shield, Eye } from 'lucide-react'
import { supabase } from '@/config/supabase'
import { useSubscription } from '@/context/SubscriptionContext'
import PermissionGuard from '@/components/SubscriptionGuard' // Actually PermissionGuard
import { usePermissionMode } from '@/context/PermissionModeContext'
import { PermissionSummary } from '@/components/dashboard/DashboardPermissions'

export default function SidebarLayout() {
  const location = useLocation()
  const { subscription } = useSubscription()
  const { session } = useSession()
  const { isOwner } = useBusiness()
  const { permissionModeEnabled } = usePermissionMode()
  const email = session?.user?.email || 'Usuario Local'
  const [sidebarOpen, setSidebarOpen] = useState(false)

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
          <div className="flex items-center gap-2 font-bold text-xl">
            <div>
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

          {permissionModeEnabled ? (
            <>
              <PermissionGuard requiredPermission="finanzas.view">
                <NavLink to="/finanzas" className={linkClass}>
                  <Wallet className="w-4 h-4" />
                  <span>Finanzas</span>
                </NavLink>
              </PermissionGuard>

              <PermissionGuard requiredPermission="inventory.view">
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
            </>
          ) : (
            <>
              <NavLink to="/finanzas" className={linkClass}>
                <Wallet className="w-4 h-4" />
                <span>Finanzas</span>
              </NavLink>

              <NavLink to="/almacen" className={linkClass}>
                <Warehouse className="w-4 h-4" />
                <span>Almacén</span>
              </NavLink>

              <NavLink to="/inventario" className={linkClass}>
                <Layers className="w-4 h-4" />
                <span>Inventario</span>
              </NavLink>

              <NavLink to="/reportes" className={linkClass}>
                <FileText className="w-4 h-4" />
                <span>Reportes</span>
              </NavLink>

              <NavLink to="/logs" className={linkClass}>
                <ShieldAlert className="w-4 h-4" />
                <span>Auditoría</span>
              </NavLink>

              <NavLink to="/configuracion" className={linkClass}>
                <Settings className="w-4 h-4" />
                <span>Configuración</span>
              </NavLink>
            </>
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
            <div className={`text-xs font-semibold px-2 py-1 rounded text-center ${subscription?.plan_id === 'premium' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
              Plan {subscription?.plan_id === 'premium' ? 'Premium' : 'Gratuito'}
            </div>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex flex-col h-screen overflow-hidden">
        {/* Mobile Header */}
        <header className="sticky top-0 z-30 flex items-center gap-4 border-b bg-background px-4 py-3 lg:hidden">
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)}>
            <Menu className="w-5 h-5" />
          </Button>
          <span className="font-semibold">Menú</span>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
