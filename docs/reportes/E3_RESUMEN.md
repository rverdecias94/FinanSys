# E3 — Resumen de entrega

Rama: `feat/reportes-e0-e1-terminologia`  
Sin migraciones. Sin historial BD (`id: null`).

## Qué se entregó

1. **`ReportDocument`** — [src/reporting/documentModel.js](../../src/reporting/documentModel.js): schema versionado, disclaimer, criteria, kpis, warnings, methodology.
2. **Adaptadores** — `fromLegacyNarrative` / `toLegacyReportShape` para que Preview y DOCX no cambien de contrato.
3. **Plantillas** — executive, finance_mgmt, warehouse, inventory_areas, global vía `buildReport()`.
4. **UI** — botón «Resumen ejecutivo» junto al Global; Word por módulo sigue usando las plantillas E3.

## Compatibilidad

- `ReportPreview` y `generateDOCX` reciben el shape legacy `{ title, metadata, sections }`.
- `narrativeGenerator` permanece como motor narrativo interno de las plantillas financieras/almacén/inventario/global.

## Pruebas

`documentModel.test.js` + metrics + E1 + financials: **40/40 OK**.

## Riesgos para E4

- Valoración / Kardex aún no están en plantillas (warnings solo).
- Ejecutivo no incluye gráficos (solo tablas/listas).
- Settled aún no alimenta el Word (solo paneles E2).
