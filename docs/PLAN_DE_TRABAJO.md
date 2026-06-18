# 🗺️ Plan de Trabajo — GESTIA / Sistema Contable

> Generado el **2026-06-17** a partir de una auditoría *council* multi-agente (44 agentes, ~2.2M tokens, 804 lecturas de código). Cada hallazgo **crítico/alto fue verificado por un segundo agente independiente** leyendo el código real (`archivo:línea`). Aquí solo se listan hallazgos **confirmados** o **parcialmente confirmados**; los refutados se descartaron.
>
> Salud por subsistema (0-100): Finanzas 62 · Almacén 62 · Inventario 66 · Reportes 68 · Auditorías 68 · RBAC 68 · Planes 68 · UI/Tema 62 · Supabase 58 · Calidad 74.
> Totales: **1 crítico, 29 altos, 35 medios, 39 bajos**.
>
> Salud técnica medida: `eslint` limpio ✅ · `build` OK (⚠️ bundle único 2.56 MB) · tests **17/19** (❌ 2 fallan en `PlansPanel.test.jsx`).

Leyenda: 🔴 crítico · 🟠 alto · 🟡 medio · ⚪ bajo · ⏱️ esfuerzo (xs/s/m/l) · 🔑 = necesita acceso a Supabase (rellenar `.env.tooling`).
Estado de cada ítem: ⬜ pendiente · 🔄 en curso · ✅ hecho y probado · 🔶 propuesto (espera aprobación) · ⏭️ pospuesto.

---

## 🔁 Trabajo por sesiones (relay)
Trabajamos en cadena: cada sesión toma la siguiente prioridad del plan, la ejecuta, **prueba en localhost**, actualiza este documento y la memoria, y al final **genera el prompt de la siguiente sesión**. Así el contexto se mantiene fresco y el MCP de Supabase (que se carga al iniciar la sesión) queda disponible.

**Protocolo de cada sesión:**
1. Leer `CLAUDE.md`, este plan y la memoria del proyecto. No inventar; verificar en código/BD reales (cita `archivo:línea`).
2. Ejecutar la fase asignada. Cambios en BD de producción: proponer + probar en rama (branching) + aprobación explícita.
3. Probar en `localhost` antes de marcar nada como ✅.
4. Actualizar el **Registro de sesiones** (abajo) y los estados de los ítems.
5. Emitir el **prompt de la siguiente sesión** en un bloque copiable.

### 📓 Registro de sesiones
| Sesión | Fecha | Fase | Resultado |
|---|---|---|---|
| 1 | 2026-06-17 | Análisis + auditoría + conexiones + memoria | ✅ Plan, `CONEXIONES.md`, `CLAUDE.md`, MCP configurado, RLS anónima verificada (0 filas) |
| 2 | 2026-06-17 | P0 — Seguridad RLS | ✅ Verificación en BD vía MCP (RLS ENABLED en todas las tablas; sin políticas `anon`; aislamiento por `business_id` OK) **+ hardening APLICADO con aprobación de Roberto** (`20260617_p0_security_hardening.sql`): P0.4 `is_premium` search_path, P0.5 +pg_temp, P0.2 REVOKE TRUNCATE/TRIGGER/REFERENCES a authenticated **y anon**, `plans` RLS. Post-verificado (proconfig, grants, advisor sin ERROR). 3 scripts peligrosos en cuarentena. **P0.1/P0.2/P0.3/P0.4/P0.5/plans = ✅**. Pendiente: smoke test en localhost + P0.6 (bucket transaction-images), P0.7 (leaked password), P0.8 (9 funciones SECURITY DEFINER sin search_path). |
| 3 | 2026-06-17 | Cierre P0 + inicio P1 | ✅ MCP disponible (token Sesión 2 válido, sin re-auth). **Smoke test en localhost SUPERADO** con cuenta real (login/INSERT/UPDATE/Configuración/Admin-Planes; el REVOKE de S2 no rompió nada; hallazgo P1.14: sin borrado en UI). **Aplicados+verificados en vivo con aprobación de Roberto:** **P0.8** (search_path en 10 funcs; advisor mutable 10→0), **P0.6** (cierre de listado anónimo del bucket transaction-images sin romper visualización; advisor 2→1), **P1.1** (bug de moneda, probado: registra en EUR), **P1.3** (fuga RBAC business_settings, fuga reproducida y cerrada con cuentas reales), **P1.2** (modo solo-lectura del modal vía `<fieldset disabled>`, probado con botón "Ver"). 3 migraciones nuevas en `supabase/migrations/`. Advisor: **0 ERROR**, 131→120. **P0.7 POSPUESTO** (requiere plan Pro de Supabase, confirmado por Roberto). Commit `836fbf5` en `main`, pusheado a GitHub. |

---

## P0 — Seguridad de datos (RLS) · URGENTE 🔑
**Por qué primero:** son datos financieros de tus clientes. Si alguno de estos scripts se aplicó a producción, los datos podrían estar expuestos. Lo primero NO es cambiar código sino **verificar el estado real de la BD**.

> **✅ Verificado en BD de producción vía MCP de Supabase (Sesión 2, 2026-06-17).** Project ref `obsxmmwrzsaahjmlhtxd`. Consultas: `pg_class.relrowsecurity`, `pg_policies`, `information_schema.role_table_grants`, `pg_proc.proconfig`, `get_advisors(security)`. Resultados por ítem abajo.

| # | Estado | Hallazgo | Evidencia / Verificación | ⏱️ |
|---|---|---|---|---|
| P0.1 | ✅ | `disable_rls.sql` desactivaba RLS en tablas clave. **VERIFICADO: RLS está ENABLED** (`relrowsecurity=true`) en **todas** las tablas de negocio (`transactions, products, movements, inventory_*, business_*, team_members, audit_logs`, etc.). Aislamiento por `business_id` correcto: las políticas usan `has_permission_secure(user_id, …)` y `get_current_business_id()`, que para `anon` devuelven falso (0 filas, confirmado Sesión 1). Único caso RLS off: `plans` (catálogo sin PII). | BD: `pg_class` (24 tablas, solo `plans` off). `rbac_hardening_v2.sql:371-545`. Script peligroso en cuarentena. | s |
| P0.2 | ✅ | `grant_all_public.sql` daba `GRANT ALL`. **CONFIRMADO ACTIVO** y además `anon` también lo tenía (más grave). **APLICADO Y VERIFICADO** (`20260617_p0_security_hardening.sql`): `REVOKE TRUNCATE, TRIGGER, REFERENCES … FROM authenticated, anon`. Tras el cambio ambos quedan solo con `DELETE, INSERT, SELECT, UPDATE` (gateados por RLS); `service_role` intacto. Follow-up abierto: evaluar revocar también `INSERT/UPDATE/DELETE` de `anon` (no usado pre-login). | BD: `role_table_grants` antes/después. Script en cuarentena. | m |
| P0.3 | ✅ | `allow_anon_transactions.sql` daba a `anon` insert/lectura. **VERIFICADO RESUELTO**: NO existen `transactions_insert_anon`/`transactions_read_anon` en `pg_policies`. Las 4 políticas de `transactions` están gateadas por `has_permission_secure(...)`. | BD: `pg_policies` (transactions: read/insert/update/delete, todas con permiso). Script en cuarentena. | s |
| P0.4 | ✅ | `is_premium()` `SECURITY DEFINER` **sin** `SET search_path`, usada dentro de RLS (`team_members_manage`). **APLICADO Y VERIFICADO** (`20260617_p0_security_hardening.sql`): `ALTER FUNCTION public.is_premium(uuid) SET search_path=public,pg_temp`. `pg_proc.proconfig` ahora = `{search_path=public, pg_temp}`; ya no aparece en `function_search_path_mutable`. | BD: `pg_proc.proconfig` antes/después. `20260213_plans_and_teams.sql:109-127`. | xs |
| P0.5 | ✅ | `check_email_availability` enumeraba cuentas. **VERIFICADO MITIGADO + reforzado**: la versión desplegada ya devolvía **solo booleano**; se añadió `pg_temp` al search_path (`20260617_p0_security_hardening.sql`). Residual: enumeración inherente a "¿email disponible?" (bajo). | BD: `pg_proc.proconfig`. `20260302_fix_check_email_availability_security.sql:1-7`. | s |
| **Acción** | ✅ | **Cuarentenar** scripts peligrosos del repo y documentar canónico. **HECHO**: `disable_rls.sql`, `20240202_allow_anon_transactions.sql`, `20260301_grant_all_public.sql` movidos a `supabase/_PELIGROSO_NO_USAR/` con README; `rbac_hardening_v2.sql` declarado estado canónico de RLS. | `supabase/_PELIGROSO_NO_USAR/README.md` | s |
| P0.6 | ✅ | **APLICADO Y VERIFICADO EN VIVO (Sesión 3)** (`20260617_p0_6_close_bucket_listing.sql`, remoto `p0_6_close_transaction_images_anon_listing`). Confirmado mecanismo: la app sube con `getPublicUrl` (`finanzas.js:24-28`) y muestra con `<img src>`; servir por URL pública **no pasa por RLS** (doc Supabase), sólo `list` la usa. Reproducida la fuga: con anon key se listaba la carpeta (user_id) y el comprobante. Fix: política SELECT restringida a `authenticated` sobre su propia carpeta (patrón company-logos); INSERT/DELETE intactos. Post-prueba: URL pública 200 (visualización intacta), listado anónimo → 0, advisor `public_bucket_allows_listing` 2→1. **Pendiente menor**: `company-logos` (menos sensible) → ver P2.6. | `20260617_p0_6_close_bucket_listing.sql`; `get_advisors`. | s 🔑 |
| P0.7 | ⏭️ | **POSPUESTO (Sesión 3): requiere plan Pro de Supabase.** `auth_leaked_password_protection` (HaveIBeenPwned) sólo es configurable en Pro+; el proyecto está en Free → el toggle aparece bloqueado. Reactivar este ítem cuando se suba a Pro: Authentication → Providers → Email → "Prevent use of leaked passwords". No bloqueante. | `get_advisors(security)` WARN (queda en 1); doc: requiere Pro Plan. | xs |
| P0.8 | ✅ | **APLICADO Y VERIFICADO (Sesión 3)** (`20260617_p0_8_function_search_path.sql`, remoto `p0_8_pin_search_path_remaining_funcs`): `ALTER FUNCTION … SET search_path=public,pg_temp` en lote para las 9 SECURITY DEFINER + el trigger `touch_business_settings_updated_at`. Verificado: `pg_proc.proconfig` = `{search_path=public, pg_temp}` en las 10; advisor `function_search_path_mutable` 10→**0**; 0 ERROR. | `20260617_p0_8_function_search_path.sql`; `pg_proc.proconfig`. | s 🔑 |
| plans | ✅ | Único `rls_disabled_in_public` (ERROR del advisor). **APLICADO** (`20260617_p0_security_hardening.sql`): `ENABLE ROW LEVEL SECURITY` + política `plans_read_all` (SELECT `USING(true)`). Lectura idéntica a antes; escrituras del cliente bloqueadas (solo `service_role`). El advisor ya **no reporta ERROR**. | `get_advisors`; `pg_class.relrowsecurity`. | xs |

> **✅ APLICADO Y VERIFICADO en producción (Sesión 2, 2026-06-17)** — con aprobación explícita de Roberto. Migración `20260617_p0_security_hardening.sql` (registrada en remoto como `p0_security_hardening`, v20260617215746). Cambios idempotentes y con rollback documentado en el propio archivo.
>
> **✅ P0 CERRADO casi por completo (Sesión 3, 2026-06-17)** — con aprobación explícita de Roberto. **Smoke test en localhost SUPERADO** (cuenta owner real): login ✅, crear transacción (INSERT) ✅, editar (UPDATE) ✅, abrir Configuración ✅, abrir Admin→Planes ✅ → el REVOKE de la Sesión 2 **no rompió nada**. (Hallazgo: la UI de Finanzas **no tiene borrado** de transacciones — sólo Editar/Ver; no es fallo del REVOKE, ver P-nuevo abajo). Aplicados y verificados en vivo: **P0.8** y **P0.6** (migraciones `20260617_p0_8_function_search_path.sql`, `20260617_p0_6_close_bucket_listing.sql`). **Único pendiente de P0: P0.7** (toggle de leaked-password en el dashboard, lo hace Roberto). Advisor: **0 ERROR**, total 131→120.

---

## P1 — RBAC y corrección de datos (lo que rompe tu promesa de roles y la exactitud contable)

| # | Hallazgo | Evidencia | ⏱️ |
|---|---|---|---|
| P1.1 | ✅ **HECHO Y PROBADO EN LOCALHOST (Sesión 3)**. **Bug de moneda**: la prop se pasaba como `businessCurrencies={...}` pero `TransactionModal` la recibe como `currencies` → caía a `[]` y luego a **USD** fijo. Fix de 1 línea en `FinanzasMejorado.jsx:477` (`currencies={businessCurrencies}`). Probado con cuenta real: activé EUR, el modal ofreció USD+EUR, creé/edité una transacción y se guardó con `currency=EUR` (verificado en BD). Lint limpio. | `TransactionModal.jsx:75` vs `FinanzasMejorado.jsx:477` | **xs** |
| P1.2 | ✅ **HECHO Y PROBADO EN LOCALHOST (Sesión 3)**. **Modo solo-lectura**: `FinanzasMejorado.jsx:478` ya pasaba `readonly` pero `TransactionModal` lo ignoraba → desde "Ver" se podía editar y guardar. Fix: el modal recibe `readonly`, envuelve los campos en `<fieldset disabled>` (deshabilita todo nativamente), `handleSubmit` hace early-return y el footer muestra solo "Cerrar". Probado con cuenta real: botón "Ver" → título "Ver Movimiento", campos `:disabled`, selector de moneda no abre, sin botón de guardar. Lint limpio. | `TransactionModal.jsx` (ahora usa `readonly`); `FinanzasMejorado.jsx:142,478` | s |
| P1.3 | ✅ **HECHO Y VERIFICADO EN VIVO (Sesión 3)** (`20260617_p1_3_business_settings_rbac.sql`, remoto `p1_3_business_settings_require_config_view`). **Fuga RBAC** reproducida: un miembro (Editor, sin `config.view`) leía `business_settings` del dueño por API REST (200, 1 fila) aunque el cliente lo bloqueaba. Fix: política `business_settings_read` con `has_permission_secure(user_id,'config.view')`. Post-prueba con cuentas reales: miembro → 0 filas (cerrado), dueño → 1 fila (intacto). Sólo se lee en `/configuracion` (ya exige `config.view`). | `20260607_business_settings.sql` (origen: `team_member_read_config_data`) → reemplazada por `20260617_p1_3_business_settings_rbac.sql` | s 🔑 |
| P1.14 | 🟡 **(NUEVO Sesión 3)** La UI de Finanzas **no permite borrar** transacciones: `FinanzasMejorado.jsx` sólo importa `createTransaction/updateTransaction/listTransactions` y la fila sólo tiene Editar/Ver. La política RLS `transactions_delete` y el grant existen, pero no hay forma de borrar desde la app. Evaluar si es intencional (auditoría) o falta funcionalidad. | `FinanzasMejorado.jsx:3,5` (sin delete) | s |
| P1.4 | 🟠 **Divergencia RBAC inventario**: la UI usa `inventory.create/edit/delete` pero la RLS exige `inventory.move`. Roles personalizados se rompen. | `FormRunner.jsx:128,314,319` vs `rbac_hardening_v2.sql:474-480` | m 🔑 |
| P1.5 | ✅ **HECHO Y PROBADO (Sesión 3)**. **Admin delegado no podía crear roles**: `RoleModal:88` mandaba `owner_id = session.user.id` (miembro), pero la RLS `roles_manage` exige `owner_id = get_current_business_id()` (dueño). Fix: usar `businessId` de `useBusiness()` (= dueño tanto para owner como para miembro). Probado: REST con un admin delegado (team.manage) → `owner_id=member` da **403 RLS**, `owner_id=business` da **201**; y el dueño sigue creando roles desde la UI con `owner_id` correcto (sin regresión). Lint limpio. | `RoleModal.jsx` (ahora usa `businessId`); RLS `roles_manage` | s |
| P1.6 | 🟠 **Race condition de stock**: cálculo read-modify-write sin atomicidad → stock incorrecto con dos movimientos simultáneos. Mover a RPC/trigger atómico. | `src/services/almacen.js:192-220` | m 🔑 |
| P1.7 | 🟠 **Stock negativo permitido**: no hay validación servidor ni `CHECK (stock>=0)`; el modal solo "advierte". | `almacen.js:210-218`; `20250207_create_almacen_schema.sql:27` | s 🔑 |
| P1.8 | 🟠 **SKU no atómico**: la secuencia avanza en RPC y el INSERT va aparte → huecos de SKU. Usar la RPC `create_inventory_item` ya existente. | `dynamicInventory.js:224-244`; `20260209_inventory_sku.sql:131-134` | s 🔑 |
| P1.9 | 🟠 **Renombrar un campo huérfana los datos**: los ítems guardan `values` por `field.name`; al renombrar, se pierden. Usar id estable como clave del JSONB. | `FormBuilder.jsx:89-101,187-191`; `dynamicInventory.js:232` | l 🔑 |
| P1.10 | 🟠 **Premium vencido sigue activo**: no hay expiración automática (`pg_cron`) y `isPremium()` ignora `current_period_end`. | `AdminPlans.jsx:112-119`; `20260611_admin_plan_panel.sql:237` | m 🔑 |
| P1.11 | 🟡 Límite de monedas/socios solo en cliente (saltable por API directa). Añadir trigger `BEFORE INSERT` (socios SÍ tiene algo de RLS; monedas no). | `CurrencyContext.jsx:72`; `TeamManagement.jsx:67-70` | m 🔑 |
| P1.12 | 🟡 Recálculo de balance trata todo tipo no-`income` como gasto. Sumar solo `expense`. | `finanzas.js` (`updateBalanceConfig`) | s |
| P1.13 | 🟡 Validación de monto laxa: acepta `Infinity`, hex, notación científica. Endurecer zod (`positive().finite()` + regex). | `TransactionModal.jsx:63-65` | s |

---

## P2 — Seguridad de exportación e integridad de auditoría

| # | Hallazgo | Evidencia | ⏱️ |
|---|---|---|---|
| P2.1 | 🟠 **Inyección de fórmulas (CSV/Excel injection)**: valores que empiezan con `= + - @` se ejecutan al abrir el `.xlsx`. Escapar en `exportToExcel`. | `src/utils/exportUtils.js:43` | s |
| P2.2 | 🟠 **PII financiera en logs**: `audit_logs.details` guarda la fila completa (montos, cuentas, referencias) y se exporta en claro. Guardar solo metadatos/diff. | `finanzas.js:138-143,193-197` | m 🔑 |
| P2.3 | 🟠 **`audit_logs` sin índices** → la vista de logs se degrada con volumen. Crear `idx_audit_logs (business_id, created_at DESC)`. | `20260213_plans_and_teams.sql:90-98` | **xs** 🔑 |
| P2.4 | 🟠 `xlsx@0.18.5` con CVEs (prototype pollution / ReDoS); npm no tiene parche. Migrar a SheetJS 0.20.2+ oficial o `exceljs`. | `package.json:47` | m |
| P2.5 | 🟠 `RangeError` al formatear moneda no-ISO rompe el reporte Word y la previsualización. `try/catch` + fallback decimal. | `narrativeGenerator.js:7-14`; `Reportes.jsx:444-448` | s |
| P2.6 | 🟠 **(NUEVO Sesión 2)** Bucket `transaction-images` **público + permite listado** → un tercero con la URL del bucket podría listar/leer comprobantes (PII financiera). Cerrar listado o pasar a privado con URLs firmadas; **antes** verificar cómo carga la app las imágenes para no romper la visualización. `company-logos` también público (menos sensible). | `get_advisors(security)`: `public_bucket_allows_listing` | m 🔑 |

---

## P3 — Experiencia premium, color y modo oscuro (tu objetivo de imagen)

| # | Hallazgo | Evidencia | ⏱️ |
|---|---|---|---|
| P3.1 | 🟠 **Ninguna fuente de marca carga** (ni Geist ni Outfit) → la app cae a `system-ui`. Decidir UNA fuente y cargarla. Impacto directo en "verse premium". | `tailwind.config.js:12-13`; `index.css:41,98,149`; `index.html:12-20` | s |
| P3.2 | 🟠 **Color ingresos/gastos inconsistente**: Dashboard usa `text-success`/`text-destructive` (correcto) pero Finanzas/Reportes usan `text-green-600`/`text-red-600` hardcodeados → tonos distintos para el mismo concepto. Estandarizar a tokens. | `FinanzasMejorado.jsx:305,310,321,326`; `MovementList.jsx` | m |
| P3.3 | 🟠 **Páginas de contraseña rompen el modo oscuro** (hardcodean `bg-white`/`bg-gray-*`). Migrar a tokens (`bg-card`, `text-foreground`…). | `ResetPassword.jsx:137-218`; `ForgotPassword.jsx:48-105` | m |
| P3.4 | 🟠 **Sin `ErrorBoundary` global**: un error de render deja pantalla en blanco al usuario PYME. Añadir fallback amigable en español. | `src/main.jsx:46-56` (0 ErrorBoundary) | s |
| P3.5 | 🟡 **Bundle único de 2.56 MB** (758 KB gzip): carga inicial lenta. Code-splitting con `manualChunks` + `import()` por ruta. | `npm run build` | m |
| P3.6 | ⚪ Accesibilidad de color (daltonismo): añadir 2º indicador no cromático (+/−, iconos) a TODO importe, no solo a las tarjetas; revisar contraste WCAG AA en ambos temas. (Recomendación web). | research | m |
| P3.7 | ⚪ Animaciones premium en Recharts: `animationDuration≈400`, `isAnimationActive` por defecto (respeta `prefers-reduced-motion`), desactivar animación en re-filtros y datasets grandes; memoizar gráficas. | research | s |
| P3.8 | ⚪ Dashboard "¿cómo voy?": 4-5 tarjetas máximo, jerarquía tipográfica, lenguaje llano, *empty states* útiles, onboarding TTV <5 min. (Recomendación web). | research | l |

---

## P4 — Higiene de migraciones y código muerto (antes de tocar la BD)

| # | Hallazgo | Evidencia | ⏱️ |
|---|---|---|---|
| P4.1 | 🟠 **Migraciones sin prefijo de fecha** (`rbac_hardening_v2.sql`, `plan_limits_*`, `fix_*`, `downgrade_*`) → el Supabase CLI no garantiza el orden; el estado final de RLS no es determinista. Renombrar con timestamp y mover diagnósticos a `scripts/`. | `supabase/migrations/` | m |
| P4.2 | 🟡 Consolidar la maraña de `fix_*_rls` (>9 migraciones) en un estado canónico; verificar `pg_policies` reales en prod. | `supabase/migrations/*fix*rls*` | l 🔑 |
| P4.3 | 🟡 `schema.sql` raíz obsoleto y peligroso (define `products` sin `user_id` y un trigger que duplicaría stock). Eliminar o marcar como no-usar. | `supabase/schema.sql:12-57` | s |
| P4.4 | 🟡 Cliente Supabase sin opciones de auth (`persistSession`, `autoRefreshToken`, `detectSessionInUrl`). Añadirlas explícitamente. | `src/config/supabase.jsx:7` | xs |
| P4.5 | 🟡 `updatePlan('free')` permite downgrade directo saltándose el wizard. Cerrar la vía o enrutarla al wizard. | `SubscriptionContext.jsx:268-280` | s 🔑 |
| P4.6 | ⚪ **Código muerto**: `AppMejorado.jsx`, `ReportesMejorado.jsx`, `src/services/reports.js` (muerto + bug de aislamiento), 2º `PermissionGuard`, `src/App.css` (chart vars teal). | varios | s |
| P4.7 | ⚪ **Dependencias sin usar**: `firebase`, `geist`, `moment`, `react-datepicker`, `@headlessui/react`, `react-scripts`; y `firebase-debug.log` residual; `name: "sistema-citas"` + auto-dep `"sistema-citas":"file:"`. Limpiar `package.json`. | `package.json` | s |

---

## P5 — Tests y verificación

| # | Tarea | ⏱️ |
|---|---|---|
| P5.1 | Arreglar los **2 tests que fallan** en `PlansPanel.test.jsx` (selector ambiguo "Solicitar Premium" → usar `getAllByRole` o acotar por contenedor; confirmar si hay botón duplicado real). | s |
| P5.2 | Añadir tests a los fixes de P1/P2 (moneda, readonly, stock negativo, escape de Excel). | m |
| P5.3 | **Probar cada cambio en `localhost`** (`npm run dev`) antes de aprobarlo (regla de Roberto). Para flujos con BD, verificar también con datos reales. | — |

---

## 🚀 Ruta recomendada (la más eficiente)
1. **Quick wins visibles sin BD** (1 sesión, mucho impacto): P1.1 (moneda), P3.1 (fuente), P3.2 (color tokens), P3.4 (ErrorBoundary), P2.1 (escape Excel). Probar en localhost.
2. **Verificación de seguridad en prod** (en cuanto tenga `.env.tooling`): P0 completo — confirmar RLS y limpiar scripts peligrosos.
3. **RBAC y datos** (P1.2–P1.10) + **higiene de migraciones** (P4.1) antes de cualquier migración nueva.
4. **Integridad/auditoría** (P2.2–P2.5) y **premium/UX** (P3.3, P3.5–P3.8).
5. **Limpieza** (P4.6–P4.7) y **tests** (P5).

> Nada se marca como "terminado" sin probarse en `localhost`. Las tareas 🔑 requieren que rellenes `.env.tooling` (ver `CONEXIONES.md`).
