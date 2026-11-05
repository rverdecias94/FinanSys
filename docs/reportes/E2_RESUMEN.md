# E2 — Resumen de entrega

Rama: `feat/reportes-e0-e1-terminologia`  
Sin migraciones. Sin E3–E7.

## Qué se entregó

1. **Motor** `src/reporting/metrics/` — reglas, flujo recorded/settled, categorías por moneda, CxC/CxP detalle.
2. **Contrato documentado** en [E2_LIQUIDACION.md](./E2_LIQUIDACION.md).
3. **UI Reportes** — toggle Registrado / Liquidado; export con etiquetas correctas; botón «Detalle» de cuentas abiertas junto a Aging.
4. **Compatibilidad** — `buildCashFlow` / `cashFlowToExportRows` / `buildPosition` conservan firma; `computeTotals` ignora `type=transfer`.

## Pruebas

`npx vitest run` sobre metrics + financials + narrative E1 + finanzas.unit: **50/50 OK**.

## Riesgos para E3

- El informe Word narrativo (E1) sigue hablando solo de **registros**, no incorpora aún la base settled.
- `listOpenAccounts` pagina 100 filas; negocios con más cuentas abiertas necesitan paginación completa en E3+.
- Posición («caja real hoy») sigue siendo saldo devengado − CxC + CxP; no es el flujo settled del período.
- Joins Supabase `account_payments` → `transactions!inner` dependen del nombre de FK; si el entorno usa otro hint, ajustar el select.
