import { cn } from '@/lib/utils'

/** Placeholder con onda (shimmer). Ocupa espacio real para evitar saltos de layout. */
function Skeleton({ className, ...props }) {
  return (
    <div
      className={cn('skeleton-shimmer rounded-md', className)}
      aria-hidden="true"
      {...props}
    />
  )
}

export { Skeleton }
