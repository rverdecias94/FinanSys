import { Badge } from '@/components/ui/badge'
import { AlertTriangle, CheckCircle2, Ban } from 'lucide-react'
import { buildDowngradeImpact } from '@/components/config/downgrade/downgradeImpact'
import { planLabel } from '@/lib/plans'
import { cn } from '@/lib/utils'

function SeverityIcon({ severity }) {
  if (severity === 'loss') return <Ban className="h-4 w-4 shrink-0 text-destructive" />
  if (severity === 'restrict') return <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
  return <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
}

export function DowngradeSummaryStep({
  preview,
  activeCurrencies,
  sortedAreas,
  areasLimit,
  monthlyTxLimit,
  productsLimit,
  currentPlan,
}) {
  const impact = buildDowngradeImpact({
    usage: preview?.usage || {},
    freeLimits: {
      ...(preview?.free_limits || {}),
      areas: areasLimit,
      monthly_transactions: monthlyTxLimit,
      products: productsLimit,
      currencies: 1,
      partners: 0,
    },
    featuresLost: preview?.features_lost || [],
    activeCurrenciesCount: activeCurrencies?.length || 0,
    areasCount: sortedAreas?.length || 0,
  })

  const fromLabel = planLabel(currentPlan || preview?.current_plan || 'premium')

  return (
    <div className="space-y-4">
      <div className="rounded-md border bg-muted/20 p-4 text-sm">
        Pasarás de <strong>{fromLabel}</strong> a <strong>Plan Inicial</strong>.
        Tus datos no se eliminan; abajo ves exactamente qué se restringe o pierdes.
      </div>

      {impact.lossesCount > 0 && (
        <div className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm">
          <strong>{impact.lossesCount}</strong> punto{impact.lossesCount === 1 ? '' : 's'} requieren atención
          (pérdida de acceso o tope más bajo).
        </div>
      )}

      <ul className="space-y-2">
        {impact.items.map((item) => (
          <li
            key={item.id}
            className={cn(
              'rounded-md border p-3 text-sm',
              item.severity === 'loss' && 'border-destructive/30 bg-destructive/5',
              item.severity === 'restrict' && 'border-warning/30 bg-warning/5',
              item.severity === 'ok' && 'bg-muted/10'
            )}
          >
            <div className="flex items-start gap-2">
              <SeverityIcon severity={item.severity} />
              <div className="min-w-0 flex-1 space-y-1">
                <div className="font-medium">{item.title}</div>
                <p className="text-muted-foreground leading-snug">{item.detail}</p>
                {item.badges?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {item.badges.map((b) => (
                      <Badge key={b} variant="secondary" className="text-[10px] sm:text-xs">
                        {b}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
