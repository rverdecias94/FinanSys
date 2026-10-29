/* eslint-disable react/prop-types */
import { Button } from '@/components/ui/button'

/** Chips de ejemplo clicables (mobile-first, wrap). */
export function ExampleChips({ label = 'Ejemplos', examples = [], onSelect, disabled }) {
  if (!examples.length) return null
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="flex flex-wrap gap-2">
        {examples.map((ex) => (
          <Button
            key={ex.id || ex.label}
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            className="h-auto max-w-full whitespace-normal px-2.5 py-1.5 text-left text-xs font-normal"
            onClick={() => onSelect?.(ex)}
          >
            {ex.label}
          </Button>
        ))}
      </div>
    </div>
  )
}
