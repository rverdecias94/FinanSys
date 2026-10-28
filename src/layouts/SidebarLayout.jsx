import { useEffect, useState, Suspense } from 'react'
import { Outlet, NavLink, Link, useLocation, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useSession } from '@/hooks/useSession'
import { useBusiness } from '@/context/BusinessContext'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Wallet, Settings, LogOut, Menu, X, ChartArea, Warehouse, Layers, FileText,
  ShieldAlert, Shield, ShieldCheck, Loader2, Users, HandCoins, PanelLeftClose, PanelLeftOpen,
} from 'lucide-react'
import { supabase } from '@/config/supabase'
import { useSubscription } from '@/context/SubscriptionContext'
import PermissionGuard from '@/components/SubscriptionGuard' // Actually PermissionGuard
import { isSystemAdmin } from '@/services/planRequests'
import { OfflineBanner } from '@/components/common/OfflineBanner'
import { PaymentReminderBanner } from '@/components/common/PaymentReminderBanner'
import { AccountGate } from '@/components/auth/AccountGate'
import { LegalConsentGate } from '@/components/auth/LegalConsentGate'
import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard'

const SIDEBAR_COLLAPSED_KEY = 'gestia.sidebarCollapsed'

const NAV_ITEMS = [
  { to: '/', label: 'Panel General', icon: ChartArea },
  { to: '/finanzas', label: 'Finanzas', icon: Wallet, permission: 'finanzas.view' },
  { to: '/contactos', label: 'Contactos', icon: Users, permission: 'finanzas.view' },
  { to: '/cuentas', label: 'Por cobrar / pagar', icon: HandCoins, permission: 'finanzas.view' },
  { to: '/almacen', label: 'Almacén', icon: Warehouse, permission: 'warehouse.view' },
  { to: '/inventario', label: 'Inventario', icon: Layers, permission: 'inventory.view' },
  { to: '/reportes', label: 'Reportes', icon: FileText, permission: 'reports.view' },
  { to: '/logs', label: 'Bitácora', icon: ShieldAlert, permission: 'logs.view' },
  { to: '/configuracion', label: 'Configuración', icon: Settings, permission: 'config.view' },
]

function SidebarTooltip({ label, children }) {
  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="right" sideOffset={8}>
        {label}
      </TooltipContent>
    </Tooltip>
  )
}

function NavIconLink({ to, label, icon: Icon, end }) {
  // Wrapper fijo: TooltipTrigger+asChild sobre NavLink rompe className función
  // y deja el icono pegado arriba-izquierda.
  return (
    <SidebarTooltip label={label}>
      <div className="flex h-10 w-10 shrink-0 items-center justify-center">
        <NavLink
          to={to}
          end={end}
          aria-label={label}
          className={({ isActive }) =>
            `flex h-10 w-10 items-center justify-center rounded-lg transition-colors ${
              isActive
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            }`
          }
        >
          <Icon className="h-4 w-4 shrink-0" />
        </NavLink>
      </div>
    </SidebarTooltip>
  )
}

export default function SidebarLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { subscription } = useSubscription()
  const { session } = useSession()
  const { isOwner, roleName, roleId } = useBusiness()
  const email = session?.user?.email || 'Usuario Local'
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1'
    } catch {
      return false
    }
  })

  const isAdminQuery = useQuery({
    queryKey: ['isSystemAdmin'],
    queryFn: isSystemAdmin,
    enabled: !!session,
    staleTime: 5 * 60 * 1000
  })

  useEffect(() => {
    setSidebarOpen(false)
  }, [location.pathname])

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? '1' : '0')
    } catch {
      /* ignore quota / private mode */
    }
  }, [collapsed])

  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  const linkClass = ({ isActive }) =>
    `flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${isActive ? 'bg-primary text-primary-foreground' : 'hover:bg-accent hover:text-accent-foreground text-muted-foreground'}`

  const renderNavItems = (mode) => (
    <>
      {NAV_ITEMS.map((item) => {
        const link =
          mode === 'icon' ? (
            <NavIconLink key={item.to} to={item.to} label={item.label} icon={item.icon} end={item.to === '/'} />
          ) : (
            <NavLink key={item.to} to={item.to} end={item.to === '/'} className={linkClass}>
              <item.icon className="w-4 h-4 shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          )

        if (!item.permission) return link
        return (
          <PermissionGuard key={item.to} requiredPermission={item.permission}>
            {link}
          </PermissionGuard>
        )
      })}

      {isAdminQuery.data && (
        mode === 'icon' ? (
          <NavIconLink to="/admin/planes" label="Admin Planes" icon={ShieldCheck} />
        ) : (
          <NavLink to="/admin/planes" className={linkClass}>
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>Admin Planes</span>
          </NavLink>
        )
      )}
    </>
  )

  return (
    <TooltipProvider>
      <div
        className={`h-screen lg:grid lg:overflow-hidden bg-background transition-[grid-template-columns] duration-300 ease-out ${
          collapsed ? 'lg:grid-cols-[72px_1fr]' : 'lg:grid-cols-[240px_1fr]'
        }`}
      >
        {/* Mobile Sidebar Overlay */}
        <div
          className={`fixed inset-0 z-40 bg-black/50 transition-opacity lg:hidden ${sidebarOpen ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
          onClick={() => setSidebarOpen(false)}
        />

        {/* Sidebar */}
        <aside
          className={`fixed inset-y-0 left-0 z-50 w-64 -translate-x-full border-r bg-card flex flex-col p-4 transition-[transform,padding] duration-300 ease-out lg:translate-x-0 lg:static lg:h-screen lg:w-auto ${
            sidebarOpen ? 'translate-x-0' : ''
          } ${collapsed ? 'lg:p-2' : ''}`}
        >
          {/* Collapsed desktop rail: logo + abrir menú + iconos con tooltip */}
          <div className={`hidden ${collapsed ? 'lg:flex' : 'lg:hidden'} h-full min-h-0 w-full flex-col items-center gap-1`}>
            <div className="mb-1 flex flex-col items-center gap-1">
              <img src="/logo_ico.png" alt="Gestia" className="h-10 w-10 object-contain" />
              <SidebarTooltip label="Abrir menú">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 text-muted-foreground"
                  onClick={() => setCollapsed(false)}
                  aria-label="Abrir menú lateral"
                >
                  <PanelLeftOpen className="h-4 w-4" />
                </Button>
              </SidebarTooltip>
            </div>

            <nav className="flex w-full flex-1 flex-col items-center gap-1 overflow-y-auto py-1">
              {renderNavItems('icon')}
            </nav>

            <div className="mt-auto flex w-full flex-col items-center gap-1 border-t border-border pt-2">
              <SidebarTooltip label="Cerrar sesión">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 text-muted-foreground"
                  onClick={handleLogout}
                  aria-label="Cerrar sesión"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </SidebarTooltip>
            </div>
          </div>

          {/* Expanded content (móvil siempre; desktop si no está colapsado) */}
          <div className={`flex h-full min-h-0 flex-col ${collapsed ? 'lg:hidden' : ''}`}>
            <div className="mb-6 flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center font-bold text-xl">
                <img src="/logo.png" alt="Logo" className="h-20 w-40 object-contain" />
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="hidden lg:inline-flex h-8 w-8 text-muted-foreground"
                  onClick={() => setCollapsed(true)}
                  aria-label="Cerrar menú lateral"
                  title="Cerrar menú"
                >
                  <PanelLeftClose className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="lg:hidden"
                  onClick={() => setSidebarOpen(false)}
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>
            </div>

            <nav className="space-y-1 flex-1 overflow-y-auto">
              {renderNavItems('full')}
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
                        className="w-full text-xs font-bold uppercase"
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

              <div className="flex items-center justify-center gap-2 text-[11px] text-muted-foreground">
                <Link to="/terminos" className="transition-colors hover:text-foreground hover:underline">
                  Términos
                </Link>
                <span aria-hidden="true">·</span>
                <Link to="/privacidad" className="transition-colors hover:text-foreground hover:underline">
                  Privacidad
                </Link>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <div className="flex flex-col h-screen overflow-hidden">
          <OfflineBanner />
          <PaymentReminderBanner />
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
            <Suspense fallback={
              <div className="flex min-h-[60vh] w-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            }>
              <Outlet />
            </Suspense>
          </main>
        </div>

        <AccountGate />
        <OnboardingWizard />
        <LegalConsentGate />
      </div>
    </TooltipProvider>
  )
}
