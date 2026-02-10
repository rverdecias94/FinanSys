import { useEffect, useState } from 'react'
import { Outlet, NavLink, useLocation } from 'react-router-dom'
import { useSession } from '@/hooks/useSession'
import { Button } from '@/components/ui/button'
import { Wallet, Settings, LogOut, Menu, X, ChartArea, Warehouse, Layers } from 'lucide-react'
import { supabase } from '@/config/supabase'

export default function SidebarLayout() {
  const location = useLocation()
  const { session } = useSession()
  const email = session?.user?.email || 'Usuario Local'
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    setSidebarOpen(false)
  }, [location.pathname])

  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  const linkClass = ({ isActive }) =>
    `flex items-center gap-2 px-3 py-2 rounded-md ${isActive ? 'bg-primary text-primary-foreground' : 'hover:bg-accent hover:text-accent-foreground'}`

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[240px_1fr]">
      <div
        className={`fixed inset-0 z-40 bg-black/70 transition-opacity lg:hidden ${sidebarOpen ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        onClick={() => setSidebarOpen(false)}
      />

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 max-w-[80vw] -translate-x-full border-r bg-sidebar p-3 flex flex-col bg-white transition-transform lg:static lg:z-auto lg:w-auto lg:max-w-none lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : ''}`}
      >
        <div className="mb-4 text-lg font-semibold flex items-center justify-between gap-2">
          <div className="flex items-center justify-center  mr-auto">
            <img src="/logo.png" alt="" className="w-auto h-10" />
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-label="Cerrar menú"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>
        <nav className="space-y-1 flex-1">
          <NavLink to="/" className={linkClass} onClick={() => setSidebarOpen(false)}>
            <ChartArea className="w-4 h-4" /> Panel
          </NavLink>
          <NavLink to="/finanzas" className={linkClass} onClick={() => setSidebarOpen(false)}>
            <Wallet className="w-4 h-4" /> Finanzas
          </NavLink>
          <NavLink to="/almacen" className={linkClass} onClick={() => setSidebarOpen(false)}>
            <Warehouse className="w-4 h-4" /> Almacén
          </NavLink>
          <NavLink to="/inventario" className={linkClass} onClick={() => setSidebarOpen(false)}>
            <Layers className="w-4 h-4" /> Inventario
          </NavLink>
          <NavLink to="/configuracion" className={linkClass} onClick={() => setSidebarOpen(false)}>
            <Settings className="w-4 h-4" /> Configuración
          </NavLink>
        </nav>
        <div className="mt-4 border-t pt-3 flex items-center justify-between gap-2 text-sm min-w-0">
          <div className="truncate min-w-0">{email}</div>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </aside>
      <div className="min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b bg-background/95 backdrop-blur px-4 py-3 lg:hidden">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(true)}
            aria-label="Abrir menú"
          >
            <Menu className="w-5 h-5" />
          </Button>
          <img src="/logo.png" alt="" className="w-auto h-10" />
          <div className="w-9" />
        </header>
        <main className="min-w-0 flex-1 p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
