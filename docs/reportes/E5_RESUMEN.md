# E5 — Resumen de entrega

## Qué se entregó

1. **`periodCutoff`** — `cutoffAt`, timezone (`America/Havana`), filtrado por corte, `sourceRefs`, metadatos de consulta.
2. **Plantilla `audit`** — eventos `audit_logs` (quién/qué/cuándo/antes/después/IP).
3. **UI** — botón Auditoría (solo con `logs.view`); todos los informes llevan fecha de corte en metadata.
4. **KPIs financieros** — `sourceRefs` hacia `transactions`.

## Consulta vs emitido

| Concepto | E5 | E6 |
|---|---|---|
| Fecha de corte | Sí | Sí |
| Recalculable si cambian datos | Sí | No (snapshot) |
| ID / hash / inmutable | No | Sí |

## Pruebas

`periodCutoff.test.js` + suites previas de reporting.
