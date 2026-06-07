import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Palette } from 'lucide-react'

export function AppearanceSection({ isOwner, themeLabel, themeValue, onTheme, fontSize, onFontSize }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Palette className="h-5 w-5" />
          Apariencia del Sistema
        </CardTitle>
        <CardDescription>Personaliza el entorno visual de la plataforma.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <Label>Modo</Label>
            <Select value={themeValue} onValueChange={onTheme} disabled={!isOwner}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dark">Modo Oscuro (Obsidian)</SelectItem>
                <SelectItem value="light">Modo Claro</SelectItem>
                <SelectItem value="system">Sistema</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Actual: {themeLabel}</p>
          </div>

          <div className="space-y-2">
            <Label>Tamaño de fuente</Label>
            <Select value={fontSize} onValueChange={onFontSize} disabled={!isOwner}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="compacta">Compacta</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="accesible">Accesible</SelectItem>
              </SelectContent>
            </Select>
            <div className="rounded-md border p-3 bg-muted/20">
              <div className="text-sm font-medium">Vista previa</div>
              <div className="text-xs text-muted-foreground mt-1">Texto de ejemplo: 1,000.00 | 1.000,00</div>
            </div>
          </div>
        </div>
        {!isOwner && <p className="text-xs text-muted-foreground">Solo el propietario puede modificar la apariencia.</p>}
      </CardContent>
    </Card>
  )
}
