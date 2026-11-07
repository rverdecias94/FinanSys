/* eslint-disable react/prop-types */
import { useState } from 'react'
import { Download, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { FORMAT_ICONS } from '@/components/icons/FileFormatIcons'
import { cn } from '@/lib/utils'

const DEFAULT_LABELS = { pdf: 'PDF', excel: 'Excel', word: 'Word' }

/**
 * Un solo botón «Exportar» que abre las opciones de formato.
 * Reduce el chrome de 3 botones a 1 (progressive disclosure).
 *
 * @param {{ format: 'pdf'|'excel'|'word', label?: string, locked?: boolean, disabled?: boolean, onClick: () => void }[]} options
 */
export function ExportMenu({
  options = [],
  label = 'Exportar',
  variant = 'outline',
  size = 'default',
  className,
  disabled = false,
  loading = false,
}) {
  const [open, setOpen] = useState(false)
  const visible = options.filter(Boolean)
  if (!visible.length) return null

  // Una sola opción: botón directo (sin sheet innecesario).
  if (visible.length === 1) {
    const only = visible[0]
    const Icon = FORMAT_ICONS[only.format] || Download
    return (
      <Button
        type="button"
        variant={variant}
        size={size}
        disabled={disabled || only.disabled || loading}
        loading={loading}
        className={cn('h-11 w-full justify-center gap-2 sm:h-9 sm:w-auto', className)}
        onClick={only.onClick}
        title={only.locked ? `${only.label || DEFAULT_LABELS[only.format]} es Premium` : undefined}
      >
        <Icon className="h-4 w-4" />
        <span>{only.label || label}</span>
        {only.locked ? <Lock className="h-3.5 w-3.5 text-muted-foreground" /> : null}
      </Button>
    )
  }

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        disabled={disabled || loading}
        loading={loading}
        className={cn('h-11 w-full justify-center gap-2 sm:h-9 sm:w-auto', className)}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <Download className="h-4 w-4" />
        <span>{label}</span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className={cn(
            'inset-x-0 bottom-0 top-auto left-0 translate-x-0 translate-y-0',
            'max-w-none rounded-t-2xl rounded-b-none border-x-0 border-b-0 p-0 sm:inset-auto sm:left-[50%] sm:top-[50%] sm:max-w-sm sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-xl sm:border',
            'data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom sm:data-[state=open]:slide-in-from-top-0',
            'pb-[max(1rem,env(safe-area-inset-bottom,0px))] sm:pb-4',
          )}
          hideClose
        >
          <DialogHeader className="border-b px-4 py-3 text-left sm:border-0 sm:pb-0">
            <DialogTitle className="text-base">{label}</DialogTitle>
          </DialogHeader>
          <ul className="space-y-1 p-2 sm:px-4 sm:pb-2" role="menu" aria-label={label}>
            {visible.map((opt) => {
              const Icon = FORMAT_ICONS[opt.format] || Download
              const text = opt.label || DEFAULT_LABELS[opt.format] || 'Archivo'
              return (
                <li key={`${opt.format}-${text}`}>
                  <button
                    type="button"
                    role="menuitem"
                    disabled={opt.disabled}
                    onClick={() => {
                      setOpen(false)
                      opt.onClick?.()
                    }}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-xl px-3 py-3.5 text-left transition-colors active:scale-[0.99]',
                      'hover:bg-muted/60 disabled:pointer-events-none disabled:opacity-50',
                    )}
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1 font-medium">{text}</span>
                    {opt.locked ? (
                      <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-label="Premium" />
                    ) : null}
                  </button>
                </li>
              )
            })}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  )
}
