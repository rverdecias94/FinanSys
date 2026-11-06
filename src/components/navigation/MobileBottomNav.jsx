import { useMemo } from 'react'
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
 * Tab bar flotante estilo app nativa (solo < lg).
 * Material glass + indicador deslizante; targets ≥44px; feedback al press.
 */
export function MobileBottomNav({ onMore }) {
  const { pathname } = useLocation()
  const { hasPermission } = usePermissions()

  const tabs = useMemo(
    () => MOBILE_PRIMARY_TABS.filter((tab) => !tab.permission || hasPermission(tab.permission)),
    [hasPermission],
  )

  const slotCount = tabs.length + 1
  const activeIndex = (() => {
    const i = tabs.findIndex((tab) => pathMatches(pathname, tab.to, tab.end))
    if (i >= 0) return i
    return tabs.length // Más
  })()

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 lg:hidden"
      style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom, 0px))' }}
    >
      <nav
        className="gestia-mobile-nav pointer-events-auto relative w-full max-w-md"
        aria-label="Navegación principal"
      >
        <div
          className={cn(
            'relative overflow-hidden rounded-full border border-border/60',
            'bg-background/80 shadow-[0_8px_28px_-6px_rgba(0,0,0,0.18)]',
            'backdrop-blur-xl backdrop-saturate-150',
            'dark:border-white/10 dark:bg-card/85 dark:shadow-[0_8px_28px_-6px_rgba(0,0,0,0.55)]',
          )}
        >
          {/* Indicador deslizante (píldora bajo el tab activo) */}
          <span
            aria-hidden="true"
            className="gestia-mobile-nav__indicator pointer-events-none absolute bottom-1.5 top-1.5 rounded-full bg-primary/12 dark:bg-primary/20"
            style={{
              width: `${100 / slotCount}%`,
              transform: `translateX(${activeIndex * 100}%)`,
            }}
          />

          <ul
            className="relative grid h-14"
            style={{ gridTemplateColumns: `repeat(${slotCount}, minmax(0, 1fr))` }}
          >
            {tabs.map((tab) => {
              const Icon = tab.icon
              return (
                <li key={tab.to} className="min-w-0">
                  <NavLink
                    to={tab.to}
                    end={tab.end}
                    aria-label={tab.label}
                    title={tab.label}
                    className={({ isActive }) =>
                      cn(
                        'gestia-mobile-nav__item flex h-14 w-full flex-col items-center justify-center gap-1',
                        'text-muted-foreground transition-[color,transform] duration-150 ease-out',
                        'active:scale-95',
                        isActive && 'text-primary',
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <Icon
                          className="h-5 w-5"
                          strokeWidth={isActive ? 2.35 : 1.7}
                          fill={isActive ? 'currentColor' : 'none'}
                          fillOpacity={isActive ? 0.18 : 0}
                          aria-hidden="true"
                        />
                        <span
                          className={cn(
                            'h-1 w-1 rounded-full transition-opacity duration-200',
                            isActive ? 'bg-primary opacity-100' : 'opacity-0',
                          )}
                          aria-hidden="true"
                        />
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
                title="Más"
                aria-current={activeIndex === tabs.length ? 'page' : undefined}
                className={cn(
                  'gestia-mobile-nav__item flex h-14 w-full flex-col items-center justify-center gap-1',
                  'text-muted-foreground transition-[color,transform] duration-150 ease-out',
                  'active:scale-95',
                  activeIndex === tabs.length && 'text-primary',
                )}
              >
                <MoreHorizontal
                  className="h-5 w-5"
                  strokeWidth={activeIndex === tabs.length ? 2.35 : 1.7}
                  aria-hidden="true"
                />
                <span
                  className={cn(
                    'h-1 w-1 rounded-full transition-opacity duration-200',
                    activeIndex === tabs.length ? 'bg-primary opacity-100' : 'opacity-0',
                  )}
                  aria-hidden="true"
                />
              </button>
            </li>
          </ul>
        </div>
      </nav>
    </div>
  )
}
