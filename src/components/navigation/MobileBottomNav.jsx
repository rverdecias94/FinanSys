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
 * Tab bar flotante: padding interior generoso, acento primary, indicador deslizante.
 * El relleno inferior opaco evita la franja clara bajo el pill (safe-area / gesture).
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
    return tabs.length
  })()

  const safePad = 'max(0.75rem, env(safe-area-inset-bottom, 0px))'

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 lg:hidden">
      {/* Relleno opaco bajo el pill: el sistema bar sigue theme-color; esto tapa el hueco de la app. */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 bg-background"
        style={{ height: `calc(${safePad} + 0.5rem)` }}
      />
      <div
        className="relative flex justify-center px-4"
        style={{ paddingBottom: safePad }}
      >
        <nav
          className="gestia-mobile-nav pointer-events-auto relative w-full max-w-md"
          aria-label="Navegación principal"
        >
          <div
            className={cn(
              'relative overflow-hidden rounded-full',
              'border-2 border-primary/25 bg-card/95',
              'shadow-[0_10px_32px_-8px_rgba(0,0,0,0.22)]',
              'backdrop-blur-xl backdrop-saturate-150',
              'dark:border-primary/35 dark:bg-card/95',
              'dark:shadow-[0_10px_32px_-8px_rgba(0,0,0,0.65)]',
            )}
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent"
            />

            <span
              aria-hidden="true"
              className="gestia-mobile-nav__indicator pointer-events-none absolute bottom-2 top-2 rounded-full bg-primary/18 dark:bg-primary/28"
              style={{
                left: 6,
                width: `calc((100% - 12px) / ${slotCount})`,
                transform: `translateX(calc(${activeIndex} * 100%))`,
              }}
            />

            <ul
              className="relative grid h-[3.75rem] px-1.5"
              style={{ gridTemplateColumns: `repeat(${slotCount}, minmax(0, 1fr))` }}
            >
              {tabs.map((tab) => {
                const Icon = tab.icon
                return (
                  <li key={tab.to} className="min-w-0 px-0.5">
                    <NavLink
                      to={tab.to}
                      end={tab.end}
                      aria-label={tab.label}
                      title={tab.label}
                      className={({ isActive }) =>
                        cn(
                          'gestia-mobile-nav__item flex h-[3.75rem] w-full flex-col items-center justify-center gap-0.5',
                          'transition-[color,transform] duration-150 ease-out active:scale-95',
                          isActive ? 'text-primary' : 'text-muted-foreground/80',
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <span
                            className={cn(
                              'flex h-8 w-8 items-center justify-center rounded-full transition-colors duration-200',
                              isActive && 'bg-primary text-primary-foreground shadow-sm shadow-primary/30',
                            )}
                          >
                            <Icon
                              className="h-[1.15rem] w-[1.15rem]"
                              strokeWidth={isActive ? 2.4 : 1.65}
                              aria-hidden="true"
                            />
                          </span>
                          <span
                            className={cn(
                              'max-w-full truncate text-[9px] font-semibold tracking-wide',
                              isActive ? 'text-primary' : 'text-muted-foreground/70',
                            )}
                          >
                            {tab.label}
                          </span>
                        </>
                      )}
                    </NavLink>
                  </li>
                )
              })}

              <li className="min-w-0 px-0.5">
                <button
                  type="button"
                  onClick={onMore}
                  aria-label="Más opciones"
                  title="Más"
                  aria-current={activeIndex === tabs.length ? 'page' : undefined}
                  className={cn(
                    'gestia-mobile-nav__item flex h-[3.75rem] w-full flex-col items-center justify-center gap-0.5',
                    'transition-[color,transform] duration-150 ease-out active:scale-95',
                    activeIndex === tabs.length ? 'text-primary' : 'text-muted-foreground/80',
                  )}
                >
                  <span
                    className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-full transition-colors duration-200',
                      activeIndex === tabs.length &&
                        'bg-primary text-primary-foreground shadow-sm shadow-primary/30',
                    )}
                  >
                    <MoreHorizontal
                      className="h-[1.15rem] w-[1.15rem]"
                      strokeWidth={activeIndex === tabs.length ? 2.4 : 1.65}
                      aria-hidden="true"
                    />
                  </span>
                  <span
                    className={cn(
                      'text-[9px] font-semibold tracking-wide',
                      activeIndex === tabs.length ? 'text-primary' : 'text-muted-foreground/70',
                    )}
                  >
                    Más
                  </span>
                </button>
              </li>
            </ul>
          </div>
        </nav>
      </div>
    </div>
  )
}
