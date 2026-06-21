import { Badge } from '@/components/ui/badge'
import { clampNonNegativeInt } from '@/components/config/downgrade/downgradeUtils'

export function DowngradeSummaryStep({ preview, activeCurrencies, sortedAreas, areasLimit, monthlyTxLimit, productsLimit }) {
  const usage = preview?.usage || {}
  const partnersCount = clampNonNegativeInt(usage.partners, 0)

  return (
    <div className="space-y-4">
      <div className="rounded-md border bg-muted/20 p-4 text-sm">
        Tu información no se eliminará. Algunas funciones quedarán limitadas y tendrás que elegir qué recursos seguirán activos en el plan gratuito.
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-md border p-3">
          <div className="text-sm font-medium">Monedas</div>
          <div className="text-sm text-muted-foreground">Se conservará 1 moneda activa.</div>
          <div className="mt-2 text-xs text-muted-foreground">Activas hoy: {clampNonNegativeInt(usage.active_currencies, activeCurrencies.length)}</div>
        </div>
        <div className="rounded-md border p-3">
          <div className="text-sm font-medium">Equipo</div>
          <div className="text-sm text-muted-foreground">Los miembros de equipo perderán acceso al negocio.</div>
          <div className="mt-2 text-xs text-muted-foreground">Miembros de equipo afectados: {partnersCount}</div>
        </div>
        <div className="rounded-md border p-3">
          <div className="text-sm font-medium">Inventario</div>
          <div className="text-sm text-muted-foreground">Solo {areasLimit} áreas quedarán editables.</div>
          <div className="mt-2 text-xs text-muted-foreground">Áreas actuales: {clampNonNegativeInt(usage.areas, sortedAreas.length)}</div>
        </div>
        <div className="rounded-md border p-3">
          <div className="text-sm font-medium">Finanzas</div>
          <div className="text-sm text-muted-foreground">{monthlyTxLimit} transacciones nuevas por mes.</div>
          <div className="mt-2 text-xs text-muted-foreground">Este mes: {clampNonNegativeInt(usage.monthly_transactions, 0)}</div>
        </div>
        <div className="rounded-md border p-3">
          <div className="text-sm font-medium">Almacén</div>
          <div className="text-sm text-muted-foreground">{productsLimit} productos dentro del límite de creación.</div>
          <div className="mt-2 text-xs text-muted-foreground">Productos actuales: {clampNonNegativeInt(usage.products, 0)}</div>
        </div>
        <div className="rounded-md border p-3">
          <div className="text-sm font-medium">Funciones</div>
          <div className="text-sm text-muted-foreground">Exportación y auditoría se desactivan en Gratis.</div>
          <div className="mt-2 flex flex-wrap gap-2">
          </div>
        </div>
      </div>
    </div>
  )
}

