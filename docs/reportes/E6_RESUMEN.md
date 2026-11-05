# E6 — Resumen de entrega

## Qué se entregó

1. **Migración** [`20261104_report_document_instances.sql`](../../supabase/migrations/20261104_report_document_instances.sql): `report_sequences`, `report_instances`, `report_exports`, RLS, trigger de inmutabilidad, RPC `allocate_report_public_id`.
2. **Servicio** `src/services/reportInstances.js` — hash SHA-256, emitir, listar, registrar export, anular.
3. **UI** — botón «Emitir informe» en la previsualización (requiere `reports_export` / Premium como Word).

## Estados

`draft` → `issued` (inmutable el snapshot) → `superseded` / `void`.

## Importante

Hay que **aplicar la migración** en Supabase antes de usar Emitir en producción/local remoto.

No se cambiaron límites de planes: emitir usa el mismo gate Premium que Word (`reports_export`).
