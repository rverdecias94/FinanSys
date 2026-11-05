# GESTIA — Pendientes por fases (consolidado)

> **Qué es esto:** una vista única de **todo lo que falta** en el proyecto, reuniendo lo
> que quedó abierto en los 9 `docs/PLAN_*.md` y las banderas de `CLAUDE.md`. Pensado para
> tener un único sitio donde mirar "¿qué sigue?" sin perderse entre planes que se solapan.
> **Fecha de consolidación:** 2026-06-24. **Fuente entre paréntesis** en cada ítem.
> Prioridad: 🔴 alta · 🟠 media · ⚪ baja/opcional. Esfuerzo: S (pequeño) · M (medio) · L (grande).

## Lo que YA está cerrado (para que no lo busques)
La mayoría de los planes operativos están **terminados y en producción**: `PLAN_DE_TRABAJO.md`
(cerrado tras Sesión 10) y `PLAN_P1_P2_CASHBOOK.md` (completado, S1–S10). En concreto ya está hecho:
RLS de producción **sana y verificada** (advisor 0 ERROR, scripts peligrosos en cuarentena),
RBAC en producción, code-splitting del bundle, fuente unificada (Outfit), opciones de auth de
Supabase, eliminación de código muerto (`AppMejorado.jsx`, `ReportesMejorado.jsx`, `firebase`),
WAC + COGS + venta conectada, antigüedad de saldos, abonos parciales, cierre de período, flujo
de efectivo y posición. **No hace falta volver sobre eso.**

---

## FASE 0 — Seguridad: confirmaciones rápidas (casi todo despejado)
- ⚪ **Secretos filtrados (T0.1).** *Verificado hoy por git:* `.env.tooling.example` **nunca se
  commiteó** y no hay ningún `.env*` trackeado → **sin exposición por el repo**. Solo queda, si
  acaso, confirmar que esos secretos no quedaran en otro sitio (logs de build de Netlify, capturas).
  (PLAN_P1_P2_CASHBOOK T0.1)
- ⚪ **Protección de contraseñas filtradas (P0.7).** Activar "Prevent use of leaked passwords"
  (HaveIBeenPwned) en Supabase. **Requiere subir a Supabase Pro**; hoy el toggle está bloqueado en
  Free. 1 clic cuando subas de plan. (PLAN_DE_TRABAJO P0.7)
- ⚪ **Revocar `INSERT/UPDATE/DELETE` a `anon`** en las tablas (hoy los conserva, aunque la RLS los
  bloquea y no se usan pre-login). Follow-up de bajo riesgo. (PLAN_DE_TRABAJO P0.2)

## FASE 1 — Terminar Pagos Premium (Fases 6–8) · 🔴 el bloque vivo más grande
Las Fases 1–5 están hechas. Falta cerrar el ciclo de monetización/administración:
- 🔴 **Fase 6 — Admin de equipo global + suspender/eliminar usuarios.** (M-L)
  - Backend: `admin_list_team_members(business_id)`, `admin_set_account_status(target, status, reason)`
    (suspender/reactivar), `admin_delete_user(target)` (**borrado permanente con cascada**),
    `admin_preview_user_deletion(target)` (conteos por tabla).
  - Frontend: pestaña **Equipo** en `AdminPlans` (lista global, suspender/reactivar/eliminar);
    `ConfirmDeleteUserDialog.jsx` con previsualización de impacto + **exigir escribir el email** antes
    de habilitar "Eliminar definitivamente".
  - ⚠️ Borrado irreversible → probar **solo en un negocio de prueba**. (PLAN_PAGOS_PREMIUM Fase 6)
- 🔴 **Fase 7 — Historial de pagos (usuario + admin).** (M)
  - Backend: `get_my_payments()`; reutilizar `admin_get_business_detail` para el lado admin.
  - Frontend: sección "Historial de pagos" en Configuración/`PlansPanel` (`PaymentHistory.jsx` con
    `ResponsiveListing`: fecha, ciclo, importe, método, referencia, período); historial admin dentro
    de `BusinessDetailDialog`. (Opcional) exportar PDF/Excel. (PLAN_PAGOS_PREMIUM Fase 7)
- 🟠 **Fase 8 — QA integral + seguridad + docs.** (M)
  - Recorrer end-to-end: compra anual → uso → aviso → gracia → bloqueo → Free o renovar; suspensión;
    borrado. Pasar `get_advisors` a las tablas/RPCs nuevas, confirmar que **cada acción admin queda
    en `audit_logs`**, y actualizar `CLAUDE.md`/docs/memoria. (PLAN_PAGOS_PREMIUM Fase 8)
- 🟠 **Verificación visual pendiente de la Fase 5:** el panel `/admin/planes` (pestaña Negocios,
  fijar fecha de pago, registrar pago) quedó **sin probar en vivo** (el preview perdió la sesión
  admin). Hacer con sesión iniciada. (PLAN_PAGOS_PREMIUM Fase 5, nota ⚠️)

## FASE 2 — Contabilidad: features de valor aún no implementados · 🟠
> ⚠️ **Antes de empezar:** decidir qué del `PLAN_CONTABLE_ROADMAP.md` sigue vigente. Varias de sus
> fases **ya las hizo el cashbook** (WAC/COGS/venta = ya hecho; flujo+posición = ya hecho; antigüedad
> y abonos = ya hecho; cierre de período = ya hecho). Lo que sigue es **lo que NO cubrió el cashbook**,
> ordenado de lo más simple a lo más complejo:
- 🟠 **SKU / código de barras en Almacén.** (S-M) `products.sku`, `products.barcode` + índice único,
  generador de SKU, UI en alta/listado de productos, búsqueda. (PLAN_CONTABLE_ROADMAP Fase 2)
- 🟠 **Cuentas de efectivo/banco.** (M) Tabla `accounts`, `transactions.account_id` (sustituye el
  `bank_account_id` huérfano), seed "Efectivo" por moneda; saber en qué cuenta entra/sale el dinero.
  (PLAN_CONTABLE_ROADMAP Fase 3)
- 🟠 **Impuesto opcional + comprobante PDF.** (M) `transactions.tax_rate`/`tax_amount`,
  `business_settings.region` con `taxLabel`/`defaultTaxRate`, comprobante PDF con **folio correlativo**,
  base para e-factura (`document_type`, `external_ref`). (PLAN_CONTABLE_ROADMAP Fase 4)
- 🟠 **Multimoneda con moneda base + tipos de cambio + consolidación.** (M) Tabla `exchange_rates`
  (carga manual), `business_settings.region.baseCurrency`, informes consolidados a la moneda base.
  (PLAN_CONTABLE_ROADMAP Fase 6)
- 🟠 **Transacciones recurrentes.** (M) Tabla `recurring_transactions` (plantilla + `frequency` +
  `next_run`) para gastos/ingresos fijos. (PLAN_CONTABLE_ROADMAP Fase 7)
- ⚪ **Resumen de impuestos exportable** (depende del impuesto de la Fase 4). (PLAN_CONTABLE_ROADMAP Fase 8)
- ⚪ **Opcionales:** escáner QR/código de barras (tras SKU); **modo discreción** (ocultar montos /
  bloqueo por PIN) — mejora de UX útil por el contexto de uso. (PLAN_CONTABLE_ROADMAP, opcionales)

## FASE 3 — Offline real: escritura sin conexión (Capa C) · 🟠
> Hoy la app ya es PWA (Capa A) y cachea lecturas (Capa B). Falta poder **crear/editar sin conexión**.
- 🟠 **C1 — Infraestructura del outbox.** (M) `setMutationDefaults` por operación,
  `resumePausedMutations()` al reconectar, **migración de BD**: columna `client_uuid uuid` con índice
  UNIQUE (idempotencia) en `transactions` (luego `products`, `movements`), badge "Pendiente de
  sincronizar" + contador. (PLAN_OFFLINE_PWA C1)
- 🟠 **C2 — Finanzas offline** (caso fácil): crear/editar transacciones con id temporal, auditoría
  diferida. (PLAN_OFFLINE_PWA C2)
- 🟠 **C5 — Almacén offline** (difícil, acotado): stock optimista + reconciliar; RPC idempotente con
  `client_uuid`; solo movimientos sobre productos ya sincronizados. (PLAN_OFFLINE_PWA C5)
- ⚪ **C4 (opcional) — Adjuntos offline:** guardar `File/Blob` en IndexedDB y subir al reconectar.
- ⚪ **Verificación end-to-end de la Capa B** con sesión: online → offline → recargar → datos visibles.
  (PLAN_OFFLINE_PWA Capa B)
- ⚪ **A3 (opcional) — toast "Hay nueva versión, recargar"** (la app ya se auto-actualiza). Y decidir
  si excluir `export-vendor` (~1.5 MB) del precache para instalar más rápido. (PLAN_OFFLINE_PWA Capa A)

## FASE 4 — Stretch contable del cashbook (opcional) · ⚪
- ⚪ **Drill-down en reportes (S11/Q15):** cifras agregadas clicables → llevan a las transacciones/venta
  de origen. (PLAN_P1_P2_CASHBOOK S11)
- ⚪ **FX realizada (S12/Q13):** ganancia/pérdida cambiaria al cobrar en otra tasa. (PLAN_P1_P2_CASHBOOK S12)

## FASE 5 — Deuda técnica y limpieza (baja, condicional) · ⚪
- ⚪ **Higiene de migraciones (P4.1):** ~63 archivos locales en `supabase/migrations/` vs 34 aplicadas
  en remoto. No es riesgo activo (los despliegues van por MCP, no por CLI). Hacer **solo si** entra otro
  dev o se quiere reconstruir la BD desde cero. (PLAN_DE_TRABAJO P4.1)
- ⚪ **Códigos de permiso con idiomas mezclados** (`finanzas.view` vs `warehouse.view`). Deuda
  consciente: **no renombrar a la ligera** (rompe RBAC y rutas). (CLAUDE.md §4)
- ⚪ **Mantenimiento:** `npx update-browserslist-db@latest`, revisar `npm audit`. (PLAN_DE_TRABAJO backlog)

## Dudas a confirmar contigo (no pude cerrarlas desde el código/docs)
1. **¿El `PLAN_CONTABLE_ROADMAP.md` sigue vigente** o lo damos por superado en lo que ya hizo el
   cashbook? (Define el alcance real de la Fase 2 de arriba.)
2. **Mojibake de textos** (`ConfiguraciÃ³n`, `Ãrea`, `lÃ­mite`…) que `PLAN_DOWNGRADE_PREMIUM_A_FREE.md`
   listaba en `PlansPanel/CurrenciesPanel/InventarioMejorado/SubscriptionContext/notifications`: ¿se
   barrió ya? No hay confirmación en los registros.
3. **`reverse_sale` (revertir una venta, S8/Q8):** el doc del cashbook se contradice (la lista como
   "stretch pendiente" pero también dice que S1–S10 están hechas). ¿Está implementada o no?
4. **Tabla `profiles` heredada / `role_legacy` / `useUserRole`:** ¿quedó como backup o es código/tabla
   muerta a limpiar? (RBAC)
5. **Permiso `inventory.move` huérfano:** P1.4 lo dejó sin uso y derivó su borrado a "limpieza P4", que
   no consta hecha. ¿Lo quitamos del catálogo?

---
*Generado consolidando: `PLAN_DE_TRABAJO.md`, `PLAN_CONTABLE_ROADMAP.md`, `PLAN_PAGOS_PREMIUM.md`,
`PLAN_OFFLINE_PWA.md`, `PLAN_DOWNGRADE_PREMIUM_A_FREE.md`, `PLAN_ADMIN_PANEL_FUTURO.md`,
`PLAN_RBAC_MIGRATION.md`, `PLAN_ARCHITECTURE.md`, `PLAN_P1_P2_CASHBOOK.md`, `CLAUDE.md`.*
