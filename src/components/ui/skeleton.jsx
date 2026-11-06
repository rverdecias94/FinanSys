import { cn } from '@/lib/utils'

/** Placeholder pulsante (shadcn). Ocupa espacio real para evitar saltos de layout. */
function Skeleton({ className, ...props }) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-muted', className)}
      {...props}
    />
  )
}

export { Skeleton }
