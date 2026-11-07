/* eslint-disable react/prop-types */
import { useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useIsMobile } from '@/hooks/useIsMobile'
import { cn } from '@/lib/utils'

/**
 * Navegación secundaria adaptativa (Operate / móvil):
 * - ≤4 opciones → segmented control de 1 fila (nunca wrap).
 * - ≥5 opciones en móvil → selector tipo Ajustes (una línea + sheet).
 * - ≥5 en desktop → pills en una sola fila con scroll + fade.
 */
export function SectionSwitcher({
  value,
  onValueChange,
  options = [],
  label = 'Sección',
  className,
}) {
  const isMobile = useIsMobile(640)
  const [open, setOpen] = useState(false)
  const active = options.find((o) => o.value === value) || options[0]
  const useMenu = isMobile && options.length >= 5

  if (!options.length || !active) return null

  if (useMenu) {
    const ActiveIcon = active.icon
    return (
      <div className={cn('w-full', className)}>
        <Button
          type="button"
          variant="outline"
          onClick={() => setOpen(true)}
          className="h-12 w-full justify-between gap-3 px-3.5 text-left font-medium active:scale-[0.99]"
          aria-haspopup="dialog"
          aria-expanded={open}
        >
          <span className="flex min-w-0 items-center gap-2.5">
            {ActiveIcon ? (
              <ActiveIcon className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            ) : null}
            <span className="min-w-0 truncate">
              <span className="text-muted-foreground font-normal">{label}: </span>
              {active.label}
            </span>
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        </Button>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent
            className={cn(
              'inset-x-0 bottom-0 top-auto left-0 translate-x-0 translate-y-0',
              'max-w-none rounded-t-2xl rounded-b-none border-x-0 border-b-0 p-0',
              'data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom',
              'data-[state=open]:zoom-in-100 data-[state=closed]:zoom-out-100',
              'pb-[max(1rem,env(safe-area-inset-bottom,0px))]',
            )}
            hideClose
          >
            <DialogHeader className="border-b px-4 py-3 text-left">
              <DialogTitle className="text-base">{label}</DialogTitle>
            </DialogHeader>
            <ul className="max-h-[min(70dvh,28rem)] overflow-y-auto p-2" role="listbox" aria-label={label}>
              {options.map((opt) => {
                const Icon = opt.icon
                const selected = opt.value === value
                return (
                  <li key={opt.value}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onClick={() => {
                        onValueChange?.(opt.value)
                        setOpen(false)
                      }}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-xl px-3 py-3.5 text-left transition-colors active:scale-[0.99]',
                        selected
                          ? 'bg-primary/12 text-foreground'
                          : 'text-foreground hover:bg-muted/60',
                      )}
                    >
                      {Icon ? (
                        <span
                          className={cn(
                            'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
                            selected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
                          )}
                        >
                          <Icon className="h-4 w-4" aria-hidden="true" />
                        </span>
                      ) : null}
                      <span className="min-w-0 flex-1 font-medium">{opt.label}</span>
                      {selected ? <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" /> : null}
                    </button>
                  </li>
                )
              })}
            </ul>
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  // Segmented / pills: 1 fila. Si no caben, scroll horizontal con fade (nunca wrap).
  const equalCols = options.length <= 4
  return (
    <div className={cn('relative w-full', className)}>
      {!equalCols && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 z-10 w-8 rounded-r-lg bg-gradient-to-l from-muted to-transparent"
        />
      )}
      <div
        role="tablist"
        aria-label={label}
        className={cn(
          'rounded-lg bg-muted p-1 text-muted-foreground',
          equalCols
            ? 'grid w-full gap-1'
            : 'flex w-full flex-nowrap gap-1 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        )}
        style={equalCols ? { gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` } : undefined}
      >
        {options.map((opt) => {
          const Icon = opt.icon
          const selected = opt.value === value
          return (
            <button
              key={opt.value}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => onValueChange?.(opt.value)}
              className={cn(
                'inline-flex h-10 items-center justify-center gap-1.5 rounded-md px-2.5 text-sm font-medium transition-[color,background-color,transform] duration-150',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                'active:scale-[0.98]',
                equalCols ? 'min-w-0' : 'shrink-0',
                selected
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {Icon ? <Icon className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden="true" /> : null}
              <span className="truncate">{opt.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
