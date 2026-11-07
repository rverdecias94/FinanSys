/* eslint-disable react/prop-types */
/**
 * Leyenda HTML debajo del pastel en móvil — evita el solapamiento típico
 * de Recharts Legend (vertical derecha / wrap denso) en pantallas ~360–414 px.
 */
export function MobileSafePieLegend({ items = [], className = '' }) {
  if (!items.length) return null

  return (
    <ul
      className={`mt-3 grid grid-cols-1 gap-2 min-[380px]:grid-cols-2 ${className}`}
      aria-label="Leyenda del gráfico"
    >
      {items.map((item) => (
        <li key={item.key || item.name} className="flex min-w-0 items-start gap-2">
          <span
            className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-sm"
            style={{ backgroundColor: item.color }}
            aria-hidden="true"
          />
          <span className="min-w-0 text-xs leading-snug text-muted-foreground">
            <span className="font-medium text-foreground">{item.name}</span>
            {item.detail ? (
              <span className="text-muted-foreground"> · {item.detail}</span>
            ) : null}
          </span>
        </li>
      ))}
    </ul>
  )
}
