import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatCurrencyLabel } from '@/components/config/downgrade/downgradeUtils'

export function DowngradeCurrencyStep({ activeCurrencies, keepCurrencyId, setKeepCurrencyId }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        El Plan Gratuito permite una sola moneda activa. Elige la moneda que seguirá como principal para tus balances y nuevas operaciones.
      </p>

      <div className="space-y-2">
        <div className="text-sm font-medium">Moneda principal</div>
        <Select
          value={keepCurrencyId ? String(keepCurrencyId) : ''}
          onValueChange={(v) => setKeepCurrencyId(Number(v))}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecciona una moneda" />
          </SelectTrigger>
          <SelectContent>
            {activeCurrencies.map((c) => (
              <SelectItem key={c.business_currency_id} value={String(c.business_currency_id)}>
                {formatCurrencyLabel(c)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border bg-muted/20 p-3 text-sm">
        Las transacciones históricas en otras monedas se conservan. Las nuevas operaciones usarán la moneda seleccionada.
      </div>
    </div>
  )
}

