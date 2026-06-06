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
  valuationMethod,
  onChangeValuationMethod,
  initialBalances,
  onChangeInitialBalance,
  currentBalances,
  onSaveBaseCurrency,
  onUpdateBalances,
  isRefreshing
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet2 className="h-5 w-5" />
          Balance y Moneda Base
        </CardTitle>
        <CardDescription>
          Define la moneda principal para la contabilidad del negocio y el saldo de apertura.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-2">
            <Label>Moneda Principal</Label>
            <Select value={mainCurrency} onValueChange={onChangeMainCurrency} disabled={!isOwner}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona" />
              </SelectTrigger>
              <SelectContent>
                {['CUP', 'USD', 'EUR', 'MXN'].map((c) => (
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

          <div className="space-y-2">
            <Label>Método de Valoración de Inventario</Label>
            <Select value={valuationMethod} onValueChange={onChangeValuationMethod} disabled={!isOwner}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fifo">PEPS / FIFO</SelectItem>
                <SelectItem value="avg">Promedio Ponderado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="secondary">Balance Inicial (Manual)</Badge>
            <span className="text-xs text-muted-foreground">CUP / USD / EUR / MXN</span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onSaveBaseCurrency} disabled={!isOwner}>
              Guardar Moneda Principal
            </Button>
            <Button onClick={onUpdateBalances} disabled={!isOwner || isRefreshing}>
              Actualizar Balance Inicial
            </Button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {['CUP', 'USD', 'EUR', 'MXN'].map((code) => (
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
          {['CUP', 'USD', 'EUR', 'MXN'].map((code) => (
            <div key={code} className="space-y-2">
              <Label>Actual {code}</Label>
              <Input value={currentBalances[code] || '0'} disabled />
            </div>
          ))}
        </div>

        <p className="text-xs text-muted-foreground">
          El balance actual se calcula automáticamente: Balance Inicial + Ingresos - Gastos.
        </p>
        {!isOwner && <p className="text-xs text-muted-foreground">Solo el propietario puede modificar el balance.</p>}
      </CardContent>
    </Card>
  )
}

