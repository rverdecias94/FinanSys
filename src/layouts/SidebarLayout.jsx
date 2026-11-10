import { useEffect, useState, Suspense } from 'react'
import { Outlet, NavLink, Link, useLocation, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useSession } from '@/hooks/useSession'
import { useBusiness } from '@/context/BusinessContext'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Wallet, LogOut, X, ChartArea, Warehouse, Layers, FileText,
  ShieldAlert, Shield, ShieldCheck, Users, HandCoins, PanelLeftClose, PanelLeftOpen,
  Sparkles, Crown, ChevronDown, Coins, Palette, Building2,
} from 'lucide-react'
import { RouteOutletSkeleton } from '@/components/common/pageSkeletons'
import { supabase } from '@/config/supabase'
import { useSubscription } from '@/context/SubscriptionContext'
import PermissionGuard from '@/components/SubscriptionGuard' // Actually PermissionGuard
import { isSystemAdmin } from '@/services/planRequests'
import { OfflineBanner } from '@/components/common/OfflineBanner'
import { PaymentReminderBanner } from '@/components/common/PaymentReminderBanner'
import { AccountGate } from '@/components/auth/AccountGate'
import { LegalConsentGate } from '@/components/auth/LegalConsentGate'
import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard'
import { FxGateProvider } from '@/context/FxGateContext'
import { cn } from '@/lib/utils'
import BrandLogo from '@/components/BrandLogo'
import { MobileBottomNav } from '@/components/navigation/MobileBottomNav'

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
      { to: '/almacen', label: 'Almacén', icon: Warehouse, permission: 'warehouse.view', hint: 'Productos que compras y vendes' },
      { to: '/inventario', label: 'Inventario', icon: Layers, permission: 'inventory.view', hint: 'Áreas, equipos y listas personalizadas' },
    ],
  },
  {
    id: 'analisis',
    label: 'Análisis',
    items: [
      { to: '/reportes', label: 'Reportes', icon: FileText, permission: 'reports.view' },
      { to: '/herramientas', label: 'Copiloto', icon: Sparkles, permission: 'finanzas.view' },
      { to: '/logs', label: 'Auditoría', icon: ShieldAlert, permission: 'logs.view' },
    ],
  },
  {
    id: 'cuenta',
    label: 'Cuenta',
    items: [
      { to: '/cuenta/plan', label: 'Mi plan', icon: Crown, permission: 'config.view', ownerOnly: true },
      { to: '/cuenta/negocio', label: 'Negocio', icon: Building2, permission: 'config.view' },
      { to: '/cuenta/monedas', label: 'Monedas', icon: Coins, permission: 'config.view' },
      { to: '/cuenta/apariencia', label: 'Apariencia', icon: Palette, permission: 'config.view' },
      { to: '/cuenta/equipo', label: 'Equipo', icon: Users, permission: 'team.manage' },
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

function labeledGroupIds() {
  return NAV_GROUPS.filter((g) => g.label).map((g) => g.id)
}

/** Acordeón: como máximo una categoría abierta. */
function accordionOpenGroups(pathname, preferredId = null) {
  const open = {}
  for (const id of labeledGroupIds()) open[id] = false

  const activeId =
    preferredId ||
    NAV_GROUPS.find((g) => g.label && groupContainsPath(g, pathname))?.id ||
    'dinero'

  if (activeId && activeId in open) open[activeId] = true
  return open
}

function defaultOpenGroups(pathname) {
  return accordionOpenGroups(pathname)
}

/** Normaliza un estado guardado (puede tener varias abiertas) a una sola. */
function normalizeOpenGroups(saved, pathname) {
  if (!saved || typeof saved !== 'object') return defaultOpenGroups(pathname)
  const activeId = NAV_GROUPS.find((g) => g.label && groupContainsPath(g, pathname))?.id
  if (activeId) return accordionOpenGroups(pathname, activeId)
  const firstOpen = labeledGroupIds().find((id) => saved[id])
  return accordionOpenGroups(pathname, firstOpen || 'dinero')
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

function NavIconLink({ to, label, icon: Icon, end, title }) {
  // Wrapper fijo: TooltipTrigger+asChild sobre NavLink rompe className función
  // y deja el icono pegado arriba-izquierda.
  const tip = title || label
  return (
    <SidebarTooltip label={tip}>
      <div className="flex h-9 w-9 shrink-0 items-center justify-center">
        <NavLink
          to={to}
          end={end}
          aria-label={tip}
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
        <span>Plan Élite</span>
      </div>
    )
  }
  if (planId === 'premium') {
    return (
      <div className="flex items-center justify-center gap-1.5 rounded-md border border-primary/50 bg-primary/10 px-2.5 py-1.5 text-xs font-bold tracking-wide text-foreground">
        <Crown className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
        <span>Plan Negocio</span>
      </div>
    )
  }
  return (
    <div className="rounded-md border border-border bg-muted px-2.5 py-1.5 text-center text-xs font-semibold text-muted-foreground">
      Plan Inicial
    </div>
  )
}

function SidebarAccountMeta({ planId, isOwner, roleName }) {
  const role = isOwner ? 'Propietario' : (roleName || 'Miembro')
  return (
    <div className="space-y-1.5">
      <PlanBadge planId={planId} />
      <div className="flex items-center justify-center gap-1.5 text-[11px] font-medium text-muted-foreground">
        <Shield className="h-3 w-3 shrink-0" aria-hidden="true" />
        <span className="truncate">{role}</span>
      </div>
    </div>
  )
}

export default function SidebarLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { subscription } = useSubscription()
  const { session } = useSession()
  const { isOwner, roleName } = useBusiness()
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
    const path = typeof window !== 'undefined' ? window.location.pathname : '/'
    return normalizeOpenGroups(readOpenGroups(), path)
  })
  const [adminOpen, setAdminOpen] = useState(() =>
    typeof window !== 'undefined' ? window.location.pathname.startsWith('/admin') : false,
  )

  const isAdminQuery = useQuery({
    queryKey: ['isSystemAdmin'],
    queryFn: isSystemAdmin,
    enabled: !!session,
    staleTime: 5 * 60 * 1000
  })

  // Al navegar: solo la categoría de la ruta activa (acordeón)
  useEffect(() => {
    if (location.pathname.startsWith('/admin')) {
      setAdminOpen(true)
      setOpenGroups((prev) => {
        const next = {}
        for (const id of labeledGroupIds()) next[id] = false
        // Evitar setState inútil si ya estaban todas cerradas
        if (labeledGroupIds().every((id) => !prev[id])) return prev
        return next
      })
      return
    }
    const activeId = NAV_GROUPS.find((g) => g.label && groupContainsPath(g, location.pathname))?.id
    if (!activeId) return
    setAdminOpen(false)
    setOpenGroups((prev) => {
      const already = labeledGroupIds().every((id) => !!prev[id] === (id === activeId))
      if (already) return prev
      return accordionOpenGroups(location.pathname, activeId)
    })
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
    setAdminOpen(false)
    setOpenGroups((prev) => {
      // Si ya estaba abierta → cerrarla (ninguna abierta).
      // Si estaba cerrada → abrir solo esa.
      if (prev[id]) {
        const next = { ...prev }
        for (const gid of labeledGroupIds()) next[gid] = false
        return next
      }
      return accordionOpenGroups(location.pathname, id)
    })
  }

  const toggleAdmin = () => {
    if (adminOpen) {
      setAdminOpen(false)
      return
    }
    setAdminOpen(true)
    setOpenGroups(() => {
      const closed = {}
      for (const gid of labeledGroupIds()) closed[gid] = false
      return closed
    })
  }

  const linkClass = ({ isActive }) =>
    cn(
      'flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm font-normal transition-colors',
      isActive
        ? 'bg-primary text-primary-foreground'
        : 'text-muted-foreground hover:bg-accent/80 hover:text-foreground'
    )

  const renderItem = (item, mode) => {
    if (item.ownerOnly && !isOwner) return null

    const link =
      mode === 'icon' ? (
        <NavIconLink key={item.to} to={item.to} label={item.label} icon={item.icon} end={item.to === '/'} title={item.hint || item.label} />
      ) : (
        <NavLink key={item.to} to={item.to} end={item.to === '/'} className={linkClass} title={item.hint || item.label}>
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
        const isOpen = !group.label || !!openGroups[group.id]

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
          <NavIconLink to="/admin/planes" label="Negocios y pagos" icon={ShieldCheck} />
        ) : (
          <div className="mb-1.5 mt-1">
            <button
              type="button"
              onClick={toggleAdmin}
              className={categoryButtonClass()}
              aria-expanded={adminOpen}
            >
              <span className="text-sm font-normal">Administrador General</span>
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
                    <span>Negocios y pagos</span>
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

  const layout = (
    <TooltipProvider>
      <div
        className={`h-dvh bg-background lg:grid lg:overflow-hidden transition-[grid-template-columns] duration-300 ease-out ${
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
          className={`fixed inset-y-0 left-0 z-50 flex w-[min(18rem,88vw)] -translate-x-full flex-col border-r bg-card p-4 pt-[max(1rem,env(safe-area-inset-top,0px))] pb-[max(1rem,env(safe-area-inset-bottom,0px))] transition-[transform,padding] duration-300 ease-out lg:static lg:h-screen lg:w-auto lg:translate-x-0 lg:pt-4 lg:pb-4 ${
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
                <BrandLogo className="h-16 w-36 object-contain" />
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

              <div className="flex flex-col gap-2">
                <SidebarAccountMeta planId={planId} isOwner={isOwner} roleName={roleName} />
                {isOwner && planId !== 'premium' && planId !== 'ultra' && (
                  <Button
                    variant="default"
                    size="sm"
                    className="w-full text-xs font-bold uppercase"
                    onClick={() => navigate('/cuenta/plan')}
                  >
                    Mejorar plan
                  </Button>
                )}
                {isOwner && planId === 'premium' && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs font-bold uppercase"
                    onClick={() => navigate('/cuenta/plan')}
                  >
                    Subir a Élite
                  </Button>
                )}
              </div>

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
        <div className="flex h-dvh flex-col overflow-hidden bg-background">
          <OfflineBanner />
          <PaymentReminderBanner />
          {/* Top bar móvil: solo marca (la navegación va abajo, como app nativa). */}
          <header
            className="sticky top-0 z-30 flex items-center border-b border-border/80 bg-background/90 px-4 py-2.5 backdrop-blur-xl lg:hidden"
            style={{ paddingTop: 'max(0.625rem, env(safe-area-inset-top, 0px))' }}
          >
            <BrandLogo className="h-8 w-auto object-contain" />
          </header>

          <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 pb-[max(1rem,calc(6.25rem+env(safe-area-inset-bottom,0px)))] sm:p-6 lg:p-8">
            <Suspense fallback={<RouteOutletSkeleton />}>
              <Outlet />
            </Suspense>
          </main>

          <MobileBottomNav onMore={() => setSidebarOpen(true)} />
        </div>

        <AccountGate />
        <OnboardingWizard />
        <LegalConsentGate />
      </div>
    </TooltipProvider>
  )

  return <FxGateProvider>{layout}</FxGateProvider>
}
