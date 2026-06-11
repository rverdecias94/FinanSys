import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Check } from 'lucide-react'

export function DowngradeAreasStep({ sortedAreas, areasLimit, keepAreaIds, toggleArea }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        El Plan Gratuito permite editar hasta {areasLimit} áreas de inventario. Elige las áreas que seguirán disponibles para crear y editar formularios. Las demás quedarán en solo lectura.
      </p>

      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">Áreas seleccionadas</div>
        <Badge variant={keepAreaIds.length > areasLimit ? 'destructive' : 'secondary'}>
          {keepAreaIds.length} / {areasLimit}
        </Badge>
      </div>

      <ScrollArea className="h-[260px] rounded-md border">
        <div className="divide-y">
          {sortedAreas.map((a) => {
            const checked = keepAreaIds.includes(Number(a.id))
            const disabled = !checked && keepAreaIds.length >= areasLimit
            return (
              <button
                type="button"
                key={a.id}
                className={`flex w-full items-center gap-3 p-3 text-left text-sm transition ${disabled ? 'opacity-60' : 'hover:bg-muted/40'}`}
                onClick={() => toggleArea(a.id)}
                disabled={disabled}
              >
                <Checkbox checked={checked} onCheckedChange={() => toggleArea(a.id)} disabled={disabled} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{a.name}</div>
                  <div className="truncate text-xs text-muted-foreground">ID: {a.id}</div>
                </div>
                {checked ? <Check className="h-4 w-4 text-success" /> : null}
              </button>
            )
          })}
        </div>
      </ScrollArea>

      <div className="rounded-md border bg-muted/20 p-3 text-sm">
        Las áreas no seleccionadas serán visibles, pero quedarán en solo lectura y no permitirán nuevos registros.
      </div>
    </div>
  )
}

