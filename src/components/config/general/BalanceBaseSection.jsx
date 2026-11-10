import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Wallet2 } from 'lucide-react'

export function BalanceBaseSection({
  isOwner,
  mainCurrency,
  onChangeMainCurrency,
  currencyCodes = [],
  initialBalances,
  onChangeInitialBalance,
  currentBalances,
  onSaveBaseCurrency,
  onUpdateBalances,
  isRefreshing
}) {
  const codes = currencyCodes.length > 0 ? currencyCodes : [mainCurrency].filter(Boolean)
  const codesLabel = codes.join(' / ') || '—'

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet2 className="h-5 w-5" />
          Balance y Moneda Base
        </CardTitle>
        <CardDescription>
          Define la moneda principal de tu caja y el saldo de apertura.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <Label>Moneda Principal</Label>
            <Select value={mainCurrency} onValueChange={onChangeMainCurrency} disabled={!isOwner}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona" />
              </SelectTrigger>
              <SelectContent>
                {codes.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Saldo Inicial de Caja/Banco</Label>
            <Input
              type="number"
              inputMode="decimal"
              step="0.01"
              value={initialBalances[mainCurrency] || ''}
              onChange={(e) => onChangeInitialBalance(mainCurrency, e.target.value)}
              disabled={!isOwner}
            />
            <p className="text-xs text-muted-foreground">Se recomienda usar dos decimales.</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">Balance Inicial (Manual)</Badge>
          <span className="text-xs text-muted-foreground break-all">{codesLabel}</span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {codes.map((code) => (
            <div key={code} className="space-y-2">
              <Label>Inicial {code}</Label>
              <Input
                type="number"
                inputMode="decimal"
                step="0.01"
                value={initialBalances[code] || ''}
                onChange={(e) => onChangeInitialBalance(code, e.target.value)}
                disabled={!isOwner}
              />
            </div>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {codes.map((code) => (
            <div key={code} className="space-y-2">
              <Label>Actual {code}</Label>
              <Input value={currentBalances[code] || '0'} disabled />
            </div>
          ))}
        </div>

        <p className="text-xs text-muted-foreground">
          Caja cobrada = saldo inicial + cobros − pagos (solo lo liquidado; lo pendiente no cuenta).
        </p>
        {!isOwner && <p className="text-xs text-muted-foreground">Solo el propietario puede modificar el balance.</p>}

        <div className="flex flex-col gap-2 border-t pt-4 sm:flex-row sm:justify-end">
          <Button variant="outline" className="w-full sm:w-auto" onClick={onSaveBaseCurrency} disabled={!isOwner}>
            Guardar Moneda Principal
          </Button>
          <Button className="w-full sm:w-auto" onClick={onUpdateBalances} disabled={!isOwner || isRefreshing}>
            Actualizar Balance Inicial
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
