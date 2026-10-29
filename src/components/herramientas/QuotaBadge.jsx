/* eslint-disable react/prop-types */
import { Badge } from '@/components/ui/badge'

export function QuotaBadge({ label, used = 0, limit = 0 }) {
  const u = Number(used) || 0
  const lim = Number(limit) || 0
  const pct = lim > 0 ? Math.min(100, Math.round((u / lim) * 100)) : 0
  const tight = lim > 0 && u / lim >= 0.85

  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-lg border bg-muted/30 px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-xs text-muted-foreground">{label}</span>
        <Badge variant={tight ? 'destructive' : 'secondary'} className="shrink-0 tabular-nums">
          {u}/{lim || '—'}
        </Badge>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-all ${tight ? 'bg-destructive' : 'bg-primary'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
