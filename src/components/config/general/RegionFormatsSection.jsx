import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Globe2 } from 'lucide-react'

export function RegionFormatsSection({
  isOwner,
  dateFormat,
  timeZone,
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
        <CardDescription>
          Zona horaria y formato de fecha se toman automáticamente de tu equipo. El formato numérico sí puedes elegirlo.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-2">
          <Label>Formato de Fecha</Label>
          <Input value={dateFormat} readOnly disabled className="bg-muted/40" />
          <p className="text-xs text-muted-foreground">Automático según la región de tu PC.</p>
        </div>

        <div className="space-y-2">
          <Label>Zona Horaria</Label>
          <Input value={timeZone} readOnly disabled className="bg-muted/40" />
          <p className="text-xs text-muted-foreground">Automática desde tu PC (no se elige a mano).</p>
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

        {!isOwner && (
          <p className="text-xs text-muted-foreground lg:col-span-3">
            Solo el propietario puede modificar el formato numérico.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
