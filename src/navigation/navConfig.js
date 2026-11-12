import {
  ChartArea, Wallet, Users, HandCoins, Warehouse, Layers, FileText,
  Sparkles, ShieldAlert, Crown, Building2, Coins, Palette,
} from 'lucide-react'

/**
 * Fuente única de agrupaciones del menú (sidebar desktop + bottom nav móvil).
 */
export const NAV_GROUPS = [
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
    mobileTo: '/finanzas',
    mobileLabel: 'Dinero',
    mobileIcon: Wallet,
    mobileDescription: 'Finanzas, contactos y cobros',
    items: [
      { to: '/finanzas', label: 'Finanzas', icon: Wallet, permission: 'finanzas.view', hint: 'Ingresos, gastos y saldos' },
      { to: '/contactos', label: 'Contactos', icon: Users, permission: 'finanzas.view', hint: 'Clientes y proveedores' },
      { to: '/cuentas', label: 'Por cobrar / pagar', icon: HandCoins, permission: 'finanzas.view', hint: 'Deudas y cobros pendientes' },
    ],
  },
  {
    id: 'existencias',
    label: 'Existencias',
    mobileTo: '/almacen',
    mobileLabel: 'Existencias',
    mobileIcon: Warehouse,
    mobileDescription: 'Almacén e inventario',
    items: [
      { to: '/almacen', label: 'Almacén', icon: Warehouse, permission: 'warehouse.view', hint: 'Productos que compras y vendes' },
      { to: '/inventario', label: 'Inventario', icon: Layers, permission: 'inventory.view', hint: 'Áreas, equipos y listas personalizadas' },
    ],
  },
  {
    id: 'analisis',
    label: 'Análisis',
    mobileTo: '/reportes',
    mobileLabel: 'Análisis',
    mobileIcon: FileText,
    mobileDescription: 'Reportes, copiloto y actividad',
    items: [
      { to: '/reportes', label: 'Reportes', icon: FileText, permission: 'reports.view', hint: 'Resúmenes del negocio' },
      { to: '/herramientas', label: 'Copiloto', icon: Sparkles, permission: 'finanzas.view', hint: 'Ayuda inteligente' },
      { to: '/logs', label: 'Auditoría', icon: ShieldAlert, permission: 'logs.view', hint: 'Quién hizo qué' },
    ],
  },
  {
    id: 'cuenta',
    label: 'Cuenta',
    mobileTo: '/cuenta/negocio',
    mobileLabel: 'Cuenta',
    mobileIcon: Building2,
    mobileDescription: 'Plan, negocio y equipo',
    items: [
      { to: '/cuenta/plan', label: 'Mi plan', icon: Crown, permission: 'config.view', ownerOnly: true, hint: 'Suscripción y límites' },
      { to: '/cuenta/negocio', label: 'Negocio', icon: Building2, permission: 'config.view', hint: 'Datos y cierre de período' },
      { to: '/cuenta/monedas', label: 'Monedas', icon: Coins, permission: 'config.view', hint: 'Tasas y monedas activas' },
      { to: '/cuenta/apariencia', label: 'Apariencia', icon: Palette, permission: 'config.view', hint: 'Tema y formato' },
      { to: '/cuenta/equipo', label: 'Equipo', icon: Users, permission: 'team.manage', hint: 'Invitar y permisos' },
    ],
  },
]

export function pathMatches(pathname, to) {
  if (to === '/') return pathname === '/'
  return pathname === to || pathname.startsWith(`${to}/`)
}

export function groupContainsPath(group, pathname) {
  return (group.items || []).some((item) => pathMatches(pathname, item.to))
}

export function findGroupForPath(pathname) {
  return NAV_GROUPS.find((g) => g.label && groupContainsPath(g, pathname)) || null
}

/** Tabs del bottom nav móvil: Inicio + 4 categorías (sin «Más»). */
export function mobileCategoryTabs() {
  return [
    { id: 'inicio', to: '/', label: 'Inicio', icon: ChartArea, end: true, match: (p) => p === '/' },
    ...NAV_GROUPS.filter((g) => g.mobileTo).map((g) => ({
      id: g.id,
      to: g.mobileTo,
      label: g.mobileLabel || g.label,
      icon: g.mobileIcon || g.items[0]?.icon,
      end: false,
      match: (p) => groupContainsPath(g, p),
      permission: g.items.find((i) => i.to === g.mobileTo)?.permission,
      siblings: g.items,
    })),
  ]
}
