/* eslint-disable react/prop-types */
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

export function QuotaBadge({ label, used = 0, limit = 0, loading = false }) {
  const u = Number(used) || 0
  const lim = Number(limit) || 0
  const pct = lim > 0 ? Math.min(100, Math.round((u / lim) * 100)) : 0
  const tight = lim > 0 && u / lim >= 0.85

  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-lg border bg-muted/30 px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-xs text-muted-foreground">{label}</span>
        {loading ? (
          <Skeleton className="h-5 w-12 rounded-full" />
        ) : (
          <Badge variant={tight ? 'destructive' : 'secondary'} className="shrink-0 tabular-nums">
            {u}/{lim || '—'}
          </Badge>
        )}
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        {loading ? (
          <Skeleton className="h-full w-1/3 rounded-full" />
        ) : (
          <div
            className={`h-full rounded-full transition-all ${tight ? 'bg-destructive' : 'bg-primary'}`}
            style={{ width: `${pct}%` }}
          />
        )}
      </div>
    </div>
  )
}
