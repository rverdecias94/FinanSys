/* eslint-disable react/prop-types */
import { Link } from 'react-router-dom'
import { ChevronRight, X } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

/**
 * Bottom sheet móvil: subopciones de una categoría del bottom nav.
 * Idea UX (no estilos de referencia): handle, cabecera con icono/título,
 * lista con subtítulo + chevron, cierre por X / overlay.
 */
export function MobileCategorySheet({
  open,
  onOpenChange,
  title,
  description,
  icon: Icon,
  items = [],
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        hideClose
        className={cn(
          '!fixed !inset-x-0 !bottom-0 !top-auto !left-0 !right-0 z-50',
          '!mx-auto w-full !max-w-lg !translate-x-0 !translate-y-0',
          'gap-0 !rounded-t-2xl rounded-b-none border-x-0 border-b-0 p-0 shadow-2xl',
          'data-[state=open]:!slide-in-from-bottom-full data-[state=closed]:!slide-out-to-bottom-full',
          'data-[state=open]:!slide-in-from-left-0 data-[state=closed]:!slide-out-to-left-0',
          'data-[state=open]:!slide-in-from-top-0 data-[state=closed]:!slide-out-to-top-0',
          'data-[state=open]:!zoom-in-100 data-[state=closed]:!zoom-out-100',
          'max-h-[min(78vh,640px)] !overflow-hidden',
          'pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]',
        )}
      >
        <div className="flex flex-col" role="navigation" aria-label={title || 'Sección'}>
          <div className="flex justify-center pt-2.5 pb-1" aria-hidden="true">
            <span className="h-1 w-10 rounded-full bg-muted-foreground/35" />
          </div>

          <DialogHeader className="space-y-0 px-4 pb-3 pt-1 text-left">
            <div className="flex items-start gap-3">
              {Icon ? (
                <span className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
              ) : null}
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-base font-semibold leading-tight">
                  {title}
                </DialogTitle>
                {description ? (
                  <DialogDescription className="mt-0.5 text-sm text-muted-foreground">
                    {description}
                  </DialogDescription>
                ) : (
                  <DialogDescription className="sr-only">
                    Elige una opción de {title}
                  </DialogDescription>
                )}
              </div>
              <button
                type="button"
                onClick={() => onOpenChange?.(false)}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border/80 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Cerrar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </DialogHeader>

          <ul className="max-h-[min(52vh,420px)] space-y-1 overflow-y-auto px-3 pb-3">
            {items.map((item) => {
              const ItemIcon = item.icon
              return (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    onClick={() => onOpenChange?.(false)}
                    className={cn(
                      'flex min-h-[3.25rem] items-center gap-3 rounded-xl px-3 py-2.5',
                      'transition-colors hover:bg-muted/70 active:bg-muted',
                    )}
                  >
                    {ItemIcon ? (
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
                        <ItemIcon className="h-4.5 w-4.5 h-[1.125rem] w-[1.125rem]" aria-hidden="true" />
                      </span>
                    ) : null}
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold leading-tight text-foreground">
                        {item.label}
                      </span>
                      {item.hint ? (
                        <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
                          {item.hint}
                        </span>
                      ) : null}
                    </span>
                    <ChevronRight
                      className="h-4 w-4 shrink-0 text-muted-foreground/70"
                      aria-hidden="true"
                    />
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  )
}
