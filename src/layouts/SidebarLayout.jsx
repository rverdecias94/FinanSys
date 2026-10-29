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
  Sparkles, Crown, ChevronDown,
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
import { cn } from '@/lib/utils'

const SIDEBAR_COLLAPSED_KEY = 'gestia.sidebarCollapsed'
const SIDEBAR_GROUPS_KEY = 'gestia.sidebarGroupsOpen'

/** Agrupación visual: categorías colapsables; rutas más discretas debajo. */
const NAV_GROUPS = [
  {
    id: 'inicio',
    label: null,
    items: [
      { to: '/', label: 'Panel General', icon: ChartArea },
    ],
  },
  {
    id: 'dinero',
    label: 'Dinero',
    items: [
      { to: '/finanzas', label: 'Finanzas', icon: Wallet, permission: 'finanzas.view' },
      { to: '/contactos', label: 'Contactos', icon: Users, permission: 'finanzas.view' },
      { to: '/cuentas', label: 'Por cobrar / pagar', icon: HandCoins, permission: 'finanzas.view' },
    ],
  },
  {
    id: 'existencias',
    label: 'Existencias',
    items: [
      { to: '/almacen', label: 'Almacén', icon: Warehouse, permission: 'warehouse.view' },
      { to: '/inventario', label: 'Inventario', icon: Layers, permission: 'inventory.view' },
    ],
  },
  {
    id: 'analisis',
    label: 'Análisis',
    items: [
      { to: '/reportes', label: 'Reportes', icon: FileText, permission: 'reports.view' },
      { to: '/herramientas', label: 'Copiloto', icon: Sparkles, permission: 'finanzas.view' },
    ],
  },
  {
    id: 'cuenta',
    label: 'Cuenta',
    items: [
      { to: '/logs', label: 'Auditoría', icon: ShieldAlert, permission: 'logs.view' },
      { to: '/configuracion', label: 'Configuración', icon: Settings, permission: 'config.view' },
    ],
  },
]

function pathMatches(pathname, to) {
  if (to === '/') return pathname === '/'
  return pathname === to || pathname.startsWith(`${to}/`)
}

function groupContainsPath(group, pathname) {
  return (group.items || []).some((item) => pathMatches(pathname, item.to))
}

function readOpenGroups() {
  try {
    const raw = localStorage.getItem(SIDEBAR_GROUPS_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

function defaultOpenGroups(pathname) {
  const open = {}
  for (const g of NAV_GROUPS) {
    if (!g.label) continue
    open[g.id] = groupContainsPath(g, pathname)
  }
  // Si ninguna ruta de grupo coincide, abrir Dinero por defecto (flujo típico)
  if (!Object.values(open).some(Boolean)) open.dinero = true
  return open
}

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
      <div className="flex h-9 w-9 shrink-0 items-center justify-center">
        <NavLink
          to={to}
          end={end}
          aria-label={label}
          className={({ isActive }) =>
            `flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${
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

function PlanBadge({ planId }) {
  if (planId === 'ultra') {
    return (
      <div className="flex items-center justify-center gap-1.5 rounded-md bg-primary px-2.5 py-1.5 text-xs font-bold tracking-wide text-primary-foreground shadow-sm">
        <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>Plan Ultra</span>
      </div>
    )
  }
  if (planId === 'premium') {
    return (
      <div className="flex items-center justify-center gap-1.5 rounded-md border border-primary/40 bg-primary/15 px-2.5 py-1.5 text-xs font-bold tracking-wide text-foreground dark:text-primary">
        <Crown className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
        <span>Plan Premium</span>
      </div>
    )
  }
  return (
    <div className="rounded-md border border-border bg-muted px-2.5 py-1.5 text-center text-xs font-semibold text-muted-foreground">
      Plan Gratuito
    </div>
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
  const [openGroups, setOpenGroups] = useState(() => {
    const saved = readOpenGroups()
    const base = defaultOpenGroups(typeof window !== 'undefined' ? window.location.pathname : '/')
    return saved ? { ...base, ...saved } : base
  })
  const [adminOpen, setAdminOpen] = useState(true)

  const isAdminQuery = useQuery({
    queryKey: ['isSystemAdmin'],
    queryFn: isSystemAdmin,
    enabled: !!session,
    staleTime: 5 * 60 * 1000
  })

  // Al navegar, forzar abierta la categoría de la ruta activa
  useEffect(() => {
    const activeId = NAV_GROUPS.find((g) => g.label && groupContainsPath(g, location.pathname))?.id
    if (!activeId) return
    setOpenGroups((prev) => {
      if (prev[activeId]) return prev
      return { ...prev, [activeId]: true }
    })
    if (location.pathname.startsWith('/admin')) setAdminOpen(true)
  }, [location.pathname])

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

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_GROUPS_KEY, JSON.stringify(openGroups))
    } catch {
      /* ignore */
    }
  }, [openGroups])

  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  const toggleGroup = (id) => {
    setOpenGroups((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const linkClass = ({ isActive }) =>
    cn(
      'flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm font-normal transition-colors',
      isActive
        ? 'bg-primary text-primary-foreground'
        : 'text-muted-foreground hover:bg-accent/80 hover:text-foreground'
    )

  const renderItem = (item, mode) => {
    const link =
      mode === 'icon' ? (
        <NavIconLink key={item.to} to={item.to} label={item.label} icon={item.icon} end={item.to === '/'} />
      ) : (
        <NavLink key={item.to} to={item.to} end={item.to === '/'} className={linkClass}>
          <item.icon className="h-3.5 w-3.5 shrink-0 opacity-80" />
          <span className="truncate">{item.label}</span>
        </NavLink>
      )

    if (!item.permission) return link
    return (
      <PermissionGuard key={item.to} requiredPermission={item.permission}>
        {link}
      </PermissionGuard>
    )
  }

  const categoryButtonClass = () =>
    cn(
      'flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left transition-colors',
      'bg-transparent text-muted-foreground hover:text-foreground'
    )

  const renderNavItems = (mode) => (
    <>
      {NAV_GROUPS.map((group) => {
        const isOpen = !group.label || openGroups[group.id] !== false

        if (mode === 'icon') {
          return (
            <div key={group.id} className="flex flex-col items-center gap-1">
              {group.label && (
                <div className="my-0.5 h-px w-6 bg-border" aria-hidden="true" />
              )}
              {group.items.map((item) => renderItem(item, mode))}
            </div>
          )
        }

        // Grupo sin etiqueta (Panel General): siempre visible
        if (!group.label) {
          return (
            <div key={group.id} className="space-y-0.5 pb-1">
              {group.items.map((item) => renderItem(item, mode))}
            </div>
          )
        }

        return (
          <div key={group.id} className="mb-1.5">
            <button
              type="button"
              onClick={() => toggleGroup(group.id)}
              className={categoryButtonClass()}
              aria-expanded={isOpen}
            >
              <span className="text-sm font-normal">
                {group.label}
              </span>
              <ChevronDown
                className={cn(
                  'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200',
                  isOpen ? 'rotate-0' : '-rotate-90'
                )}
                aria-hidden="true"
              />
            </button>
            <div
              className={cn(
                'grid transition-[grid-template-rows] duration-200 ease-out',
                isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
              )}
            >
              <div className="overflow-hidden">
                <div className="mt-0.5 space-y-0.5 border-l-2 border-border/80 ml-2 pl-1.5">
                  {group.items.map((item) => renderItem(item, mode))}
                </div>
              </div>
            </div>
          </div>
        )
      })}

      {isAdminQuery.data && (
        mode === 'icon' ? (
          <NavIconLink to="/admin/planes" label="Admin Planes" icon={ShieldCheck} />
        ) : (
          <div className="mb-1.5 mt-1">
            <button
              type="button"
              onClick={() => setAdminOpen((v) => !v)}
              className={categoryButtonClass()}
              aria-expanded={adminOpen}
            >
              <span className="text-sm font-normal">Sistema</span>
              <ChevronDown
                className={cn(
                  'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200',
                  adminOpen ? 'rotate-0' : '-rotate-90'
                )}
                aria-hidden="true"
              />
            </button>
            <div
              className={cn(
                'grid transition-[grid-template-rows] duration-200 ease-out',
                adminOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
              )}
            >
              <div className="overflow-hidden">
                <div className="mt-0.5 space-y-0.5 border-l-2 border-border/80 ml-2 pl-1.5">
                  <NavLink to="/admin/planes" className={linkClass}>
                    <ShieldCheck className="h-3.5 w-3.5 shrink-0 opacity-80" />
                    <span>Admin Planes</span>
                  </NavLink>
                </div>
              </div>
            </div>
          </div>
        )
      )}
    </>
  )

  const planId = subscription?.plan_id

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
          {/* Collapsed desktop rail */}
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

          {/* Expanded content */}
          <div className={`flex h-full min-h-0 flex-col ${collapsed ? 'lg:hidden' : ''}`}>
            <div className="mb-4 flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center font-bold text-xl">
                <img src="/logo.png" alt="Logo" className="h-16 w-36 object-contain" />
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

            <nav className="flex-1 space-y-0.5 overflow-y-auto pr-0.5">
              {renderNavItems('full')}
            </nav>

            <div className="mt-auto space-y-3 border-t pt-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 text-sm font-medium truncate" title={email}>
                  {email}
                </div>
                <Button variant="ghost" size="icon" onClick={handleLogout} className="h-8 w-8 shrink-0">
                  <LogOut className="w-4 h-4" />
                </Button>
              </div>

              {isOwner && (
                <div className="flex flex-col gap-2">
                  <PlanBadge planId={planId} />
                  {planId !== 'premium' && planId !== 'ultra' && (
                    <Button
                      variant="default"
                      size="sm"
                      className="w-full text-xs font-bold uppercase"
                      onClick={() => navigate('/configuracion')}
                    >
                      MEJORAR PLAN
                    </Button>
                  )}
                  {planId === 'premium' && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-xs font-bold uppercase"
                      onClick={() => navigate('/configuracion')}
                    >
                      Subir a Ultra
                    </Button>
                  )}
                </div>
              )}

              {!isOwner && (roleName || roleId) && (
                <div className="flex items-center justify-center gap-1.5 text-xs font-semibold px-2 py-1.5 rounded-md text-center border border-blue-500/30 bg-blue-500/10 text-blue-800 dark:text-blue-200">
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
