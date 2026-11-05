# Reportes — rediseño documental

## Documentos

| Archivo | Contenido |
|---|---|
| [arquitectura-documental.md](./arquitectura-documental.md) | Investigación de referencia (especificación funcional, no checklist obligatorio) |
| [baseline-vitest-reportes-e0.txt](./baseline-vitest-reportes-e0.txt) | Baseline E0 de tests del módulo reportes |
| [baseline-vitest-full-e0.txt](./baseline-vitest-full-e0.txt) | Baseline E0 del suite completo (incluye fallos preexistentes ajenos a reportes) |
| [E1_COMPARATIVA.md](./E1_COMPARATIVA.md) | Comparación de textos/indicadores antes y después de E1 |

## Suites de prueba (separadas)

| Archivo | Propósito |
|---|---|
| `src/utils/narrativeGenerator.baseline.test.js` | Documenta el **comportamiento pre-E1** (incl. defectos de terminología). Tras E1 queda en `describe.skip` histórico. |
| `src/utils/narrativeGenerator.e1.test.js` | Verifica el **comportamiento esperado post-E1** (terminología descriptiva, UDM, multi-moneda). |
| `src/utils/narrativeGenerator.test.js` | Regresión estable (P2.5, inventario, global) — no debe romperse con E1. |

## Entregas

- **E0–E1** (rama `feat/reportes-e0-e1-terminologia`): docs + baseline + corrección de terminología.
- **E2** (misma rama): motor `src/reporting/metrics/` + flujo registrado/liquidado + detalle CxC/CxP. Ver [E2_LIQUIDACION.md](./E2_LIQUIDACION.md).
- **E3** (misma rama): `ReportDocument` + plantillas + `buildReport` / `toLegacyReportShape`. Ver [E3_RESUMEN.md](./E3_RESUMEN.md).
- **E4** (misma rama): existencias + Kardex con `unit_cost` histórico. Ver [E4_RESUMEN.md](./E4_RESUMEN.md).
- **E5** (misma rama): fecha de corte, sourceRefs, auditoría. Ver [E5_RESUMEN.md](./E5_RESUMEN.md).
- **E6–E7**: siguientes.
