import { cn } from '@/lib/utils'

/**
 * Tarjeta-acción para elegir tipo de informe.
 * Feedback al press (active:scale), área táctil amplia, jerarquía featured vs secundaria.
 */
export function ReportTypeCard({
  icon: Icon,
  title,
  description,
  onClick,
  disabled = false,
  featured = false,
  className,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'group flex min-h-[4.5rem] w-full items-start gap-3 rounded-xl border p-3 text-left',
        'transition-[transform,background-color,border-color,box-shadow] duration-150 ease-out',
        'active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        featured
          ? 'border-primary/35 bg-primary/5 shadow-sm hover:border-primary/50 hover:bg-primary/10'
          : 'border-border bg-card hover:bg-muted/50',
        'disabled:pointer-events-none disabled:opacity-50',
        className
      )}
    >
      <span
        className={cn(
          'mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
          featured ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground group-hover:text-foreground'
        )}
        aria-hidden
      >
        {Icon ? <Icon className="h-5 w-5" /> : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-medium leading-snug tracking-tight">{title}</span>
        {description ? (
          <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground line-clamp-2">
            {description}
          </span>
        ) : null}
      </span>
    </button>
  )
}
