import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
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
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-2">
            <Label>Modo</Label>
            <div className="grid gap-2">
              <Button variant={themeValue === 'dark' ? 'default' : 'outline'} onClick={() => onTheme('dark')} disabled={!isOwner}>
                Modo Oscuro (Obsidian)
              </Button>
              <Button variant={themeValue === 'light' ? 'default' : 'outline'} onClick={() => onTheme('light')} disabled={!isOwner}>
                Modo Claro
              </Button>
              <Button variant={themeValue === 'system' ? 'default' : 'outline'} onClick={() => onTheme('system')} disabled={!isOwner}>
                Sistema
              </Button>
            </div>
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

          <div className="space-y-2">
            <Label>Miniatura del tema</Label>
            <div className="rounded-lg border p-4">
              <div className="h-3 w-24 rounded bg-muted" />
              <div className="mt-3 h-10 rounded bg-card border" />
              <div className="mt-2 h-10 rounded bg-card border" />
              <div className="mt-3 h-2 w-16 rounded bg-primary" />
            </div>
          </div>
        </div>
        {!isOwner && <p className="text-xs text-muted-foreground">Solo el propietario puede modificar la apariencia.</p>}
      </CardContent>
    </Card>
  )
}

