import { useMemo, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { usePermissions } from '@/context/PermissionContext'
import { useBusiness } from '@/context/BusinessContext'
import { mobileCategoryTabs, pathMatches, NAV_GROUPS } from '@/navigation/navConfig'
import { MobileCategorySheet } from '@/components/navigation/MobileCategorySheet'
import { cn } from '@/lib/utils'

export function isMobilePrimaryRoute(pathname) {
  return mobileCategoryTabs().some((tab) =>
    tab.match ? tab.match(pathname) : pathMatches(pathname, tab.to, tab.end),
  )
}

function filterTabItems(items, { owner, hasPermission }) {
  return (items || []).filter((item) => {
    if (item.ownerOnly && !owner) return false
    if (!item.permission) return true
    if (owner) return true
    return hasPermission(item.permission)
  })
}

/**
 * Bottom nav móvil: Inicio + 4 categorías.
 * Si la categoría tiene varias subrutas, abre un bottom sheet (no drawer lateral).
 */
export function MobileBottomNav() {
  const { pathname } = useLocation()
  const { hasPermission, isOwner } = usePermissions()
  const { isOwner: businessOwner } = useBusiness()
  const owner = isOwner || businessOwner
  const [sheetGroupId, setSheetGroupId] = useState(null)

  const tabs = useMemo(() => {
    return mobileCategoryTabs().filter((tab) => {
      if (!tab.permission) return true
      if (owner) return true
      return hasPermission(tab.permission)
    })
  }, [hasPermission, owner])

  const sheetGroup = useMemo(
    () => NAV_GROUPS.find((g) => g.id === sheetGroupId) || null,
    [sheetGroupId],
  )
  const sheetItems = useMemo(
    () => filterTabItems(sheetGroup?.items, { owner, hasPermission }),
    [sheetGroup, owner, hasPermission],
  )

  const activeIndex = Math.max(
    0,
    tabs.findIndex((tab) => (tab.match ? tab.match(pathname) : pathMatches(pathname, tab.to, tab.end))),
  )
  const slotCount = Math.max(tabs.length, 1)
  const safePad = 'max(0.75rem, env(safe-area-inset-bottom, 0px))'

  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 lg:hidden">
        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 bg-background"
          style={{ height: `calc(${safePad} + 0.5rem)` }}
        />
        <div className="relative flex justify-center px-4" style={{ paddingBottom: safePad }}>
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
                  const active = tab.match ? tab.match(pathname) : pathMatches(pathname, tab.to, tab.end)
                  const siblings = filterTabItems(tab.siblings, { owner, hasPermission })
                  const opensSheet = siblings.length > 1

                  return (
                    <li key={tab.id || tab.to} className="min-w-0 px-0.5">
                      {opensSheet ? (
                        <button
                          type="button"
                          aria-label={tab.label}
                          title={tab.label}
                          aria-haspopup="dialog"
                          aria-expanded={sheetGroupId === tab.id}
                          onClick={() => setSheetGroupId(tab.id)}
                          className={cn(
                            'gestia-mobile-nav__item flex h-[3.75rem] w-full flex-col items-center justify-center gap-0.5',
                            'transition-[color,transform] duration-150 ease-out active:scale-95',
                            active ? 'text-primary' : 'text-muted-foreground/80',
                          )}
                        >
                          <span
                            className={cn(
                              'flex h-8 w-8 items-center justify-center rounded-full transition-colors duration-200',
                              active && 'bg-primary text-primary-foreground shadow-sm shadow-primary/30',
                            )}
                          >
                            <Icon
                              className="h-[1.15rem] w-[1.15rem]"
                              strokeWidth={active ? 2.4 : 1.65}
                              aria-hidden="true"
                            />
                          </span>
                          <span
                            className={cn(
                              'max-w-full truncate text-[9px] font-semibold tracking-wide',
                              active ? 'text-primary' : 'text-muted-foreground/70',
                            )}
                          >
                            {tab.label}
                          </span>
                        </button>
                      ) : (
                        <NavLink
                          to={siblings[0]?.to || tab.to}
                          end={tab.end}
                          aria-label={tab.label}
                          title={tab.label}
                          className={cn(
                            'gestia-mobile-nav__item flex h-[3.75rem] w-full flex-col items-center justify-center gap-0.5',
                            'transition-[color,transform] duration-150 ease-out active:scale-95',
                            active ? 'text-primary' : 'text-muted-foreground/80',
                          )}
                        >
                          <span
                            className={cn(
                              'flex h-8 w-8 items-center justify-center rounded-full transition-colors duration-200',
                              active && 'bg-primary text-primary-foreground shadow-sm shadow-primary/30',
                            )}
                          >
                            <Icon
                              className="h-[1.15rem] w-[1.15rem]"
                              strokeWidth={active ? 2.4 : 1.65}
                              aria-hidden="true"
                            />
                          </span>
                          <span
                            className={cn(
                              'max-w-full truncate text-[9px] font-semibold tracking-wide',
                              active ? 'text-primary' : 'text-muted-foreground/70',
                            )}
                          >
                            {tab.label}
                          </span>
                        </NavLink>
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          </nav>
        </div>
      </div>

      <MobileCategorySheet
        open={Boolean(sheetGroup) && sheetItems.length > 1}
        onOpenChange={(next) => {
          if (!next) setSheetGroupId(null)
        }}
        title={sheetGroup?.mobileLabel || sheetGroup?.label}
        description={sheetGroup?.mobileDescription}
        icon={sheetGroup?.mobileIcon}
        items={sheetItems}
      />
    </>
  )
}
