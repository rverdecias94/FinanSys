# E4 — Resumen de entrega

## Qué se entregó

1. **`warehouseMetrics`** — Kardex y existencias por producto; valoración solo con `movements.unit_cost`; N/D si falta; nunca `avg_cost` actual.
2. **Plantillas** — Existencias (`almacen`) y Kardex (`kardex`).
3. **`fetchMovementsForReporting`** — historial hasta fin de período por fecha efectiva (`moved_at` || `created_at`).
4. **UI** — botones Existencias y Kardex en la pestaña Almacén.

## Regla de valoración

| Dato | Uso |
|---|---|
| `movements.unit_cost` | Sí — coste sellado de la línea |
| `products.avg_cost` | No — es el promedio actual |
| Historial incompleto | Indicadores de valor = **N/D** |

## Pruebas

Suite `warehouseMetrics.test.js` + documentModel (kardex/existencias).
