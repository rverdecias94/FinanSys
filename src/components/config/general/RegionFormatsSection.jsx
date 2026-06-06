import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Globe2 } from 'lucide-react'

export function RegionFormatsSection({
  isOwner,
  dateFormat,
  onDateFormat,
  timeZone,
  onTimeZone,
  timeZones,
  numberFormat,
  onNumberFormat
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe2 className="h-5 w-5" />
          Formatos y Región
        </CardTitle>
        <CardDescription>Cómo se muestran fechas, horas y valores en tablas y reportes.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-2">
          <Label>Formato de Fecha</Label>
          <Select value={dateFormat} onValueChange={onDateFormat} disabled={!isOwner}>
            <SelectTrigger>
              <SelectValue placeholder="Selecciona" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="DD/MM/AAAA">DD/MM/AAAA</SelectItem>
              <SelectItem value="AAAA-MM-DD">AAAA-MM-DD</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Zona Horaria</Label>
          <Select value={timeZone} onValueChange={onTimeZone} disabled={!isOwner}>
            <SelectTrigger>
              <SelectValue placeholder="Selecciona" />
            </SelectTrigger>
            <SelectContent>
              {timeZones.map((tz) => (
                <SelectItem key={tz} value={tz}>
                  {tz}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Formato Numérico y Decimales</Label>
          <Select value={numberFormat} onValueChange={onNumberFormat} disabled={!isOwner}>
            <SelectTrigger>
              <SelectValue placeholder="Selecciona" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="es-ES">$1.000,00</SelectItem>
              <SelectItem value="en-US">$1,000.00</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {!isOwner && <p className="text-xs text-muted-foreground lg:col-span-3">Solo el propietario puede modificar formatos regionales.</p>}
      </CardContent>
    </Card>
  )
}

