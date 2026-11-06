import { NavLink, useLocation } from 'react-router-dom'
import { ChartArea, Wallet, Warehouse, FileText, MoreHorizontal } from 'lucide-react'
import { usePermissions } from '@/context/PermissionContext'
import { cn } from '@/lib/utils'

/** Destinos principales (≤4) + Más. Regla UX: bottom nav ≤5. */
export const MOBILE_PRIMARY_TABS = [
  { to: '/', label: 'Inicio', icon: ChartArea, end: true },
  { to: '/finanzas', label: 'Finanzas', icon: Wallet, permission: 'finanzas.view' },
  { to: '/almacen', label: 'Almacén', icon: Warehouse, permission: 'warehouse.view' },
  { to: '/reportes', label: 'Reportes', icon: FileText, permission: 'reports.view' },
]

function pathMatches(pathname, to, end) {
  if (end || to === '/') return pathname === '/'
  return pathname === to || pathname.startsWith(`${to}/`)
}

export function isMobilePrimaryRoute(pathname) {
  return MOBILE_PRIMARY_TABS.some((tab) => pathMatches(pathname, tab.to, tab.end))
}

/**
 * Tab bar inferior estilo app nativa (solo < lg).
 * Material translúcido + safe-area; targets ≥44px.
 */
export function MobileBottomNav({ onMore }) {
  const { pathname } = useLocation()
  const { hasPermission } = usePermissions()
  const moreActive = !isMobilePrimaryRoute(pathname)

  const tabs = MOBILE_PRIMARY_TABS.filter(
    (tab) => !tab.permission || hasPermission(tab.permission),
  )

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border/80 bg-background/90 backdrop-blur-xl lg:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      aria-label="Navegación principal"
    >
      <ul
        className="mx-auto grid max-w-lg"
        style={{ gridTemplateColumns: `repeat(${tabs.length + 1}, minmax(0, 1fr))` }}
      >
        {tabs.map((tab) => {
          const Icon = tab.icon
          return (
            <li key={tab.to} className="min-w-0">
              <NavLink
                to={tab.to}
                end={tab.end}
                aria-label={tab.label}
                className={({ isActive }) =>
                  cn(
                    'flex min-h-[48px] flex-col items-center justify-center gap-0.5 px-1 pt-1.5 text-[10px] font-medium transition-colors active:opacity-70',
                    isActive ? 'text-primary' : 'text-muted-foreground',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <span
                      className={cn(
                        'flex h-7 w-7 items-center justify-center rounded-full transition-colors',
                        isActive && 'bg-primary/15',
                      )}
                    >
                      <Icon
                        className="h-[1.15rem] w-[1.15rem]"
                        strokeWidth={isActive ? 2.25 : 1.75}
                        aria-hidden="true"
                      />
                    </span>
                    <span className="max-w-full truncate">{tab.label}</span>
                  </>
                )}
              </NavLink>
            </li>
          )
        })}
        <li className="min-w-0">
          <button
            type="button"
            onClick={onMore}
            aria-label="Más opciones"
            aria-current={moreActive ? 'page' : undefined}
            className={cn(
              'flex min-h-[48px] w-full flex-col items-center justify-center gap-0.5 px-1 pt-1.5 text-[10px] font-medium transition-colors active:opacity-70',
              moreActive ? 'text-primary' : 'text-muted-foreground',
            )}
          >
            <span
              className={cn(
                'flex h-7 w-7 items-center justify-center rounded-full transition-colors',
                moreActive && 'bg-primary/15',
              )}
            >
              <MoreHorizontal
                className="h-[1.15rem] w-[1.15rem]"
                strokeWidth={moreActive ? 2.25 : 1.75}
                aria-hidden="true"
              />
            </span>
            <span>Más</span>
          </button>
        </li>
      </ul>
    </nav>
  )
}
