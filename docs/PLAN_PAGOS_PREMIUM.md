# PLAN — Pagos Premium, ciclos de facturación, bloqueo por impago y panel admin

> Estado: **PLAN (para ejecutar por sesiones)**. Basado en auditoría real del código y de la
> BD en vivo (Supabase) el **2026-06-20**. Cada fase es **una sesión**: migración + código +
> prueba en `localhost` (móvil y desktop) + `vitest` + `build`; si todo pasa → **commit** y se
> entrega el **prompt de la siguiente sesión**.
>
> Reglas del proyecto que aplican (CLAUDE.md): nada por memoria, verificación adversarial,
> **probar en localhost SIEMPRE**, UX premium, **color con significado** (ingresos verde / gastos
> rojo, avisos ámbar, bloqueo rojo), **mobile-first y pixel-perfect**, responder en español.

---

## 0. Decisiones tomadas (Roberto, 2026-06-20)

1. **Precios y descuento:** Premium = **$10 USD/mes** (ya en `plans.price_monthly`).
   - **Mensual:** $10 (1 mes)
   - **Trimestral:** $30 (3 meses, sin descuento)
   - **Anual:** **$102** ($120 − **15%**, ahorro $18, 12 meses) → badge "Ahorra 15%"
   - El **15% aplica solo al ciclo anual**.
2. **Vencimiento:** **aviso previo** (banner ámbar, defecto **7 días** antes) + **días de gracia**
   tras el vencimiento (banner rojo, defecto **3 días**) y **luego bloqueo duro**.
3. **Eliminar usuarios (admin):**
   - **Desactivar** = suspender (reversible, no puede entrar).
   - **Eliminar** = **borrado permanente real** (auth.users + todos sus datos), con doble
     confirmación (escribir el email del negocio) y previsualización de impacto.

---

## 1. Estado actual verificado (qué NO hay que reinventar)

### Base de datos (Supabase — verificado en vivo)
- `plans`: `free` (precio 0) y `premium` (`price_monthly = 10.00`).
  - free `limits`: `{areas:5, partners:0, products:40, currencies:1, monthly_transactions:40}`,
    features `{watermark:true, audit_logs:false, reports_export:false, custom_branding:false}`.
  - premium `limits`: todo `-1` (ilimitado) salvo `partners:5`; features Premium en `true`.
- `subscriptions` (**PK `user_id`** = owner del negocio): `plan_id`, `status`
  (`active|trial|past_due|cancelled`), `trial_*`, `current_period_start`, `current_period_end`,
  `source`, `approved_by/at`, `cancelled_by/at`, `admin_notes`.
  **NO existe:** `billing_cycle`, importe, ni estado de bloqueo.
- `system_admins` + `is_system_admin()` → **1 admin configurado**.
- `plan_change_requests` (solicitudes manuales) + índice de "una pendiente por negocio".
- `team_members` (subcuentas de equipo, `status` pending/active/revoked).
- `payment_methods` = **catálogo** (name, description, is_active) con **9 filas**.
  ⚠️ **NO es historial de pagos.** Falta una tabla de historial.

### RPCs existentes
`request_plan_change`, `approve_plan_change_request`, `reject_plan_change_request`,
`cancel_my_pending_plan_change_request`, `admin_set_business_plan`,
`expire_past_due_subscriptions` (gated admin), **cron** `expire_premium_subscriptions_auto`
(job diario 03:00 UTC que hoy **baja Premium→Free** al vencer), `get_my_downgrade_preview`,
`apply_downgrade_to_free`, `get_effective_plan_id`, `get_business_plan_id`, `get_plan_limit`.

### Frontend
- `src/pages/AdminPlans.jsx` + `src/components/admin/` (`PlanRequestsTable`,
  `PlanRequestDetailsDialog`, `ApprovePlanRequestDialog`, `RejectPlanRequestDialog`,
  `AdminSetBusinessPlanCard`). **Solo gestiona solicitudes de plan.**
- Ruta `/admin/planes` protegida con `systemAdminOnly` (`src/App.jsx:83`), enlace en sidebar
  condicionado a `isSystemAdmin` (`src/layouts/SidebarLayout.jsx:131`).
- `src/context/SubscriptionContext.jsx`: `normalizeExpiredPremium` (trata premium vencido como
  free al leer), `isPremium`, `checkLimit`, `canAccessFeature`, `requestPremium`,
  `cancelPendingPremiumRequest`, `updatePlan` (bloqueado para premium/free directo).
- `src/components/config/PlansPanel.jsx`: solicitar Premium (meses 1/3/6/12, **sin precios**) +
  **asistente de downgrade ya hecho** (`DowngradeToFreeDialog` → `apply_downgrade_to_free`).
- `src/components/config/TeamManagement.jsx`: invitar/listar/revocar equipo (nivel owner).
- Patrón de **banner global**: `OfflineBanner` montado en `SidebarLayout.jsx:188`.
- Notificaciones vía `sonner` (`src/services/notifications.jsx`).

### Brechas (lo que pides y falta)
| # | Pedido | Estado actual |
|---|--------|---------------|
| A | Admin: listar **todos los negocios** | ❌ solo lista solicitudes |
| B | Admin: listar **subcuentas de equipo** (global) | ❌ solo el owner ve su equipo |
| C | Admin: **eliminar / desactivar** usuarios y subcuentas | ❌ no existe |
| D | **Ciclos** mensual/trimestral/anual + **15%** | ❌ solo "meses", sin precios ni descuento |
| E | Admin: **controlar fecha de pago** Premium | ⚠️ parcial (`admin_set_business_plan` fija período) |
| F | **Deshabilitar** Premium **y equipo** por impago | ⚠️ hoy degradación silenciosa a free |
| G | **Bloqueo duro** con modal (contactar admin **o** pasar a Free) | ❌ no existe |
| H | **Banner fijo** de aviso de pago próximo | ❌ no existe |
| I | **Historial de pagos** (usuario + admin) | ❌ no existe tabla ni UI |
| J | Downgrade Premium→Free eligiendo qué se bloquea | ✅ ya existe (reutilizar) |

---

## 2. Diseño transversal (se implementa repartido en las fases)

### 2.1 Máquina de estados de facturación (`payment_state`)
Resuelta en servidor (`get_effective_plan_state`) y en cliente (SubscriptionContext):

| payment_state | Condición (premium) | UX |
|---|---|---|
| `ok` | `current_period_end > now + lead_days` | sin banner, Premium pleno |
| `due_soon` | `now ≤ due ≤ now + lead_days` | **banner ámbar**: "vence el DD/MM" |
| `grace` | `due < now ≤ due + grace_days` | **banner rojo**: "pago vencido, regulariza en X días"; Premium sigue activo |
| `blocked` | `now > due + grace_days` | **modal bloqueante** (no se puede entrar) |
| `free` | plan free/cancelled | flujo normal Free |

- Durante `grace` el Premium **sigue funcionando** (el negocio no se interrumpe de golpe).
- Durante `blocked`, el **owner** ve un modal con 2 caminos: **(1) contactar al administrador**
  para renovar, **(2) pasar a Plan Gratis** (asistente existente `apply_downgrade_to_free`).
- Durante `blocked`, los **miembros de equipo** también quedan bloqueados (modal "contacta a tu
  administrador"). No se borran filas: el bloqueo es en el gate.
- **Defaults configurables** (tabla `billing_config`, 1 fila global): `reminder_lead_days = 7`,
  `grace_days = 3`. El admin podrá ajustarlos a futuro.

### 2.2 Cambio de comportamiento respecto a P1.10 (importante)
Hoy `normalizeExpiredPremium` y el cron convierten Premium vencido → Free **en silencio**.
El nuevo modelo **reemplaza** eso por gracia + bloqueo:
- Cron pasa a **avanzar el ciclo de vida** (`active → past_due → suspended`) **sin** convertir a
  free automáticamente.
- La conversión a free ocurre **solo** si el owner la elige (downgrade) o el admin la aplica.
- `normalizeExpiredPremium` se sustituye por el cálculo de `payment_state` (no fuerza free en
  gracia; bloquea tras la gracia). Se actualiza `isPremium()` en consecuencia.

### 2.3 Suspensión / borrado de cuentas (admin)
- Nueva tabla `account_status` (`user_id` PK, `status` `active|suspended|deleted`, `reason`,
  `updated_by`, `updated_at`). Aplica a **cualquier** usuario (owner o miembro).
- El **gate** de la app consulta `get_my_account_status()`: si `suspended`/`deleted` → modal
  bloqueante "cuenta suspendida, contacta al administrador".
- **Eliminar = borrado real**: RPC `admin_delete_user(target)` con previsualización de filas a
  borrar y borrado en cascada explícito de todas las tablas con `user_id = target`
  (transactions, products, inventory_*, business_currencies, business_settings, audit_logs,
  payments, team_members, plan_change_requests, subscriptions, system_admins, account_status) y,
  por último, `auth.users`.

### 2.4 Historial de pagos (`payments`)
```
id            bigint identity PK
business_id   uuid not null              -- owner del negocio
amount        numeric not null
currency_code text not null default 'USD'
billing_cycle text check (in 'monthly','quarterly','annual')
period_start  timestamptz
period_end    timestamptz
paid_at       timestamptz not null default now()
method        text                       -- nombre/id de payment_methods
reference     text
status        text default 'paid' check (in 'paid','refunded')
request_id    uuid null references plan_change_requests(id)
recorded_by   uuid                       -- admin que registró
notes         text
created_at    timestamptz default now()
```
RLS: lectura para owner + equipo del negocio + admin; **inserción/edición solo admin** (vía RPC).
Cada aprobación/activación de Premium **crea** una fila de pago con el importe del ciclo.

### 2.5 Precios (fuente única)
Guardar en `plans` un bloque de precios para no hardcodear en el front:
```
plans.pricing (jsonb) = { "monthly":10, "quarterly":30, "annual":102, "annual_discount_pct":15, "currency":"USD" }
```
El front lee `pricing` (con fallback a constantes). Importe del pago = `pricing[cycle]`.

---

## 3. Fases (una por sesión)

> Cada fase incluye: **Objetivo**, **Backend**, **Frontend**, **UX/estilos**, **Escenarios de
> prueba**, **Definición de Hecho (DoD)**. El orden respeta dependencias (datos → estado en
> cliente → banner → bloqueo → flujo de compra → admin → historial → QA).

### Fase 1 — Cimientos de datos: precios, ciclos, historial y estado de facturación · ✅ HECHA (2026-06-20)
**Objetivo:** dejar la BD lista para ciclos, importes, historial y cálculo de `payment_state`.
Sin cambios visibles de UX todavía (salvo no romper nada).

> **Aplicada** vía `apply_migration` (en historial). Archivos:
> `supabase/migrations/20260620_pagos_f1_pricing_payments_state.sql` (+ `_fix_get_effective_plan_state_ambiguity`
> + `20260620_pagos_f1_harden_grants.sql`). Verificado en prod (transacciones revertidas): los 5 estados
> (ok/due_soon/grace/blocked/free), RLS de `payments` (owner/miembro ven, no-relacionado no), `admin_set`
> anual crea pago $102, `approve` compatible 3-args ($10 mensual) y override de ciclo ($30 trimestral).
> `anon` revocado, FKs indexadas, policy optimizada. `build` ✅; `vitest` 50/52 (2 fallos **pre-existentes**
> en `PlansPanel.test.jsx`, ajenos a este cambio backend).

**Backend (migración + RPCs):**
- `ALTER TABLE subscriptions ADD COLUMN billing_cycle text DEFAULT 'monthly'` (+ check).
- `UPDATE plans SET pricing = ...` (bloque §2.5) para `premium` (free sin precio).
- Tabla `billing_config` (1 fila): `reminder_lead_days int default 7`, `grace_days int default 3`.
- Tabla `payments` (§2.4) + índices `(business_id, paid_at desc)` + RLS.
- RPC `get_effective_plan_state(target_business_id uuid)` → `{plan_id, status, payment_state,
  current_period_end, grace_until, days_until_due, billing_cycle}` (SECURITY DEFINER, gated:
  owner/miembro del negocio o admin).
- RPC `admin_record_payment(business_id, amount, currency, cycle, period_start, period_end,
  method, reference, notes)` (solo admin) → inserta en `payments` + auditoría.
- Extender `approve_plan_change_request` y `admin_set_business_plan` para aceptar `billing_cycle`,
  derivar meses del ciclo, fijar `current_period_end` y **crear fila en `payments`**.

**Frontend:** ninguno funcional (solo asegurar que lecturas existentes siguen OK).

**Escenarios de prueba (SQL/MCP):**
- `get_effective_plan_state` devuelve `ok/due_soon/grace/blocked/free` según fechas simuladas.
- Aprobar con ciclo anual fija período +12 meses y crea pago de $102.
- `payments` con RLS: owner ve los suyos, otro negocio no, admin ve todos.

**DoD:** migración aplicada y verificada; `vitest` y `build` verdes; commit.

---

### Fase 2 — Estado de facturación en cliente + **banner fijo** de aviso de pago · ✅ HECHA (2026-06-20)
**Objetivo:** que la app conozca `payment_state` y muestre el **banner fijo** (pre-vencimiento y
gracia). Sin bloqueo todavía.

> **Hecho.** `src/services/billing.js` (`getEffectivePlanState`); `SubscriptionContext` expone
> `paymentState/daysUntilDue/nextPaymentDate/billingCycle/graceUntil` y deriva la suscripción
> efectiva (Premium se mantiene en gracia; solo cae a free en `blocked`; fallback offline al
> comportamiento previo). Nuevo `PaymentReminderBanner` montado en `SidebarLayout` (ámbar
> `--warning` en due_soon, rojo `--destructive` en grace; solo owner). `PlansPanel` muestra ciclo
> y próximo pago. **Verificado en localhost** (simulación reversible del vencimiento, restaurado):
> due_soon a 375px (ámbar, sin overflow), grace (rojo, "se bloqueará en 2 días"), desktop 1 línea,
> ok → banner oculto. `lint`/`build` ✅; `vitest` 52/52.

**Backend:** ninguno nuevo (usa `get_effective_plan_state`).

**Frontend:**
- `SubscriptionContext`: exponer `paymentState`, `daysUntilDue`, `nextPaymentDate`,
  `billingCycle`, `graceUntil` (vía `get_effective_plan_state`). Reemplazar el uso de
  `normalizeExpiredPremium` por este cálculo (sin forzar free en gracia).
- Nuevo `src/components/common/PaymentReminderBanner.jsx` (patrón `OfflineBanner`), montado en
  `SidebarLayout.jsx` junto al `OfflineBanner`:
  - `due_soon` → ámbar (`--warning`) con icono y CTA "Renovar / Ver planes".
  - `grace` → rojo (`--destructive`) "Pago vencido · se bloqueará en X días".
  - Solo visible para **owner**; oculto en `ok`/`free`.
- `PlansPanel`: mostrar **fecha de próximo pago** y **ciclo** del Premium activo.

**UX/estilos:** mobile-first; banner sticky bajo el header sin solापar contenido; respeta modo
claro/oscuro; texto truncado correcto en móvil.

**Escenarios de prueba (localhost, `preview_resize` móvil + desktop):**
- Premium con vencimiento a 5 días → banner ámbar.
- Premium vencido dentro de gracia → banner rojo con días restantes.
- Premium `ok` y Free → sin banner.

**DoD:** probado a ancho móvil y desktop; sin overflow; `vitest`/`build` verdes; commit.

---

### Fase 3 — **Bloqueo duro**: gate + modal (vencido/suspendido) + cron de ciclo de vida · ✅ HECHA (2026-06-20)
**Objetivo:** impedir el acceso cuando `payment_state = blocked` o cuenta suspendida; ofrecer
renovar (contactar admin) o **pasar a Gratis** (asistente existente).

> **Hecho.** Migración `20260620_pagos_f3_account_status_lifecycle.sql`: tabla `account_status`
> (+ `get_my_account_status`), cron repuntado a `advance_billing_lifecycle()` (active→past_due→
> suspended, **sin** bajar a free en silencio), y `get_effective_plan_state`/`get_effective_plan_id`
> **conscientes de gracia** (premium se mantiene en gracia; free solo bloqueado/suspendido).
> Front: `useAccountStatus`, `AccountGate` (montado en `SidebarLayout`) y `AccountBlockedDialog`
> (owner: contactar admin + "Cambiar a Plan Gratis"→asistente; member/account: aviso; cierre de
> sesión). Falla **abierto** (no bloquea si el estado es desconocido); **exime a system admins**.
> Verificado: backend por SQL (account_status, cron, gracia↔premium, bloqueo↔free); gate por test
> RTL (58/58) y smoke visual del modal (móvil 375 + desktop, overlay cubre, sin overflow).
> `lint`/`build` ✅.

**Backend:**
- Tabla `account_status` (§2.3) + RLS + `get_my_account_status()`.
- Reescribir el cron a `advance_billing_lifecycle()`: `active→past_due` al pasar `due`;
  `past_due→suspended` al pasar `due+grace`; **sin** convertir a free. Reprogramar `cron.schedule`.
- Ajustar `get_effective_plan_state` para `suspended` → `blocked`.

**Frontend:**
- Nuevo `src/components/auth/AccountGate.jsx` que envuelve el área protegida (dentro de
  providers, alrededor de `SidebarLayout`/`Outlet`):
  - Owner `blocked` → `AccountBlockedDialog` (no descartable): explica situación, datos de
    contacto del admin, botón **"Contactar administrador"** y botón **"Cambiar a Plan Gratis"**
    (abre `DowngradeToFreeDialog` → `apply_downgrade_to_free`).
  - Miembro con owner `blocked` o cuenta `suspended` → modal "contacta a tu administrador".
  - Cuenta `suspended`/`deleted` → modal de cuenta inhabilitada.
- Quitar la antigua degradación silenciosa: tabs premium ya no "desaparecen" por vencimiento;
  ahora el gate decide.

**Escenarios de prueba (localhost):**
- Owner Premium tras gracia → no puede entrar; ve modal; "Pasar a Gratis" ejecuta downgrade y
  entra en Free.
- Owner Premium tras gracia → "Contactar admin" muestra contacto (no desbloquea solo).
- Miembro de un owner bloqueado → bloqueado con su modal.
- Cuenta suspendida por admin → modal aunque el plan esté vigente.
- Premium `ok`/`grace` → entra normal.

**DoD:** todos los escenarios verdes en localhost (móvil/desktop); `vitest`/`build`; commit.

---

### Fase 4 — Ciclos de pago + **15%** en el flujo de solicitud Premium · ✅ HECHA (2026-06-20)
**Objetivo:** que el usuario elija **Mensual/Trimestral/Anual** con precios y descuento, y que la
solicitud lleve el ciclo e importe.

> **Hecho.** Migración `20260620_pagos_f4_request_billing_cycle.sql`: `plan_change_requests`
> +`billing_cycle`/`requested_amount`; `request_plan_change` acepta `billing_cycle` (deriva meses e
> importe de `plans.pricing`); `approve_plan_change_request` usa por defecto el ciclo solicitado.
> Front: `SubscriptionContext` expone `pricing`; `requestPremium`/`requestPlanChange`/
> `approvePlanChangeRequest` propagan `billingCycle`; `PlansPanel` muestra **3 tarjetas de ciclo**
> (Mensual $10 / Trimestral $30 / Anual $102 "Ahorra 15%"); `ApprovePlanRequestDialog` selector de
> ciclo + importe solicitado; `PlanRequestDetailsDialog` muestra ciclo/importe. Verificado: backend
> por SQL (solicitar anual→aprobar crea pago $102/+12m); UI en localhost (tarjetas a 375 y desktop,
> selección con anillo primary, alturas iguales, sin overflow); `vitest` 58/58 (tests actualizados al
> nuevo contrato); `lint`/`build` ✅.

**Backend:**
- `ALTER TABLE plan_change_requests ADD COLUMN billing_cycle text DEFAULT 'monthly'`,
  `requested_amount numeric`.
- Extender `request_plan_change` para aceptar/validar `billing_cycle` y calcular importe desde
  `plans.pricing`.

**Frontend:**
- `PlansPanel` (modal solicitar Premium): selector de **ciclo** con 3 tarjetas (precio, ahorro;
  badge "Ahorra 15%" en Anual), reemplazando el actual selector de meses. Pasar `billingCycle`.
- `planRequests.js`/`SubscriptionContext.requestPremium`: incluir `billingCycle`.
- `ApprovePlanRequestDialog`: mostrar ciclo/importe solicitado; al aprobar, fijar período por
  ciclo y registrar pago (Fase 1).

**Escenarios de prueba:**
- Solicitar Anual → request guarda `annual`/$102; aprobar fija +12 meses y crea pago $102.
- Mensual/Trimestral análogos ($10/$30).
- Cálculo de descuento correcto y visible (mobile/desktop).

**DoD:** verde en localhost; `vitest`/`build`; commit.

---

### Fase 5 — Admin: **listado de negocios** + control de **fecha de pago** + registrar pago
**Objetivo:** el admin ve todos los negocios y gestiona su Premium y fechas de pago.

**Backend (RPCs admin, SECURITY DEFINER, gated `is_system_admin()`):**
- `admin_list_businesses(filters)` → por negocio: email (de `auth.users`), `plan_id`, `status`,
  `payment_state`, `billing_cycle`, `current_period_end`, nº miembros, último pago.
- `admin_get_business_detail(business_id)` → datos + pagos + miembros + solicitudes.
- `admin_set_payment_date(business_id, new_period_end)` → ajusta `current_period_end` + auditoría.
- (reutiliza `admin_set_business_plan`, `admin_record_payment`).

**Frontend:**
- `AdminPlans.jsx`: convertir en panel con **pestañas** (Solicitudes | **Negocios** | Equipo |
  Config). Pestaña **Negocios**: `ResponsiveListing` con columnas plan/ciclo/estado/próximo pago
  y acciones: activar/extender Premium (con ciclo), **cambiar fecha de pago**, **registrar pago**,
  ver detalle. Nuevos componentes `src/components/admin/BusinessesTable.jsx`,
  `BusinessDetailDialog.jsx`, `SetPaymentDateDialog.jsx`, `RecordPaymentDialog.jsx`.

**Escenarios de prueba (localhost como admin):**
- Listado muestra negocios con su estado real; filtros funcionan.
- Cambiar fecha de pago refleja nuevo `payment_state` (ok/grace) en el negocio afectado.
- Registrar pago aparece en historial del negocio y del usuario.

**DoD:** verde móvil/desktop; `vitest`/`build`; commit.

---

### Fase 6 — Admin: **subcuentas de equipo** (global) + **desactivar/eliminar** usuarios
**Objetivo:** el admin ve y gestiona subcuentas de cualquier negocio y puede suspender o borrar
cuentas.

**Backend (RPCs admin):**
- `admin_list_team_members(business_id default null)` → subcuentas (email, rol, status, negocio).
- `admin_set_account_status(target_user_id, status, reason)` → suspender/reactivar (owner o
  miembro) + auditoría.
- `admin_delete_user(target_user_id)` → **borrado permanente** con cascada explícita (§2.3) +
  auditoría previa; función `admin_preview_user_deletion(target)` que devuelve conteos por tabla.
- (Suspensión integra con `AccountGate` de Fase 3.)

**Frontend:**
- Pestaña **Equipo** en `AdminPlans`: lista global de subcuentas con acciones
  suspender/reactivar/eliminar. En negocios: suspender/eliminar al owner.
- `ConfirmDeleteUserDialog.jsx`: muestra previsualización de impacto y exige **escribir el email**
  del negocio antes de habilitar "Eliminar definitivamente".

**Escenarios de prueba (localhost como admin):**
- Suspender owner → ese owner (y su equipo) ve modal de cuenta suspendida; reactivar lo restaura.
- Suspender miembro → solo ese miembro bloqueado.
- Previsualización de borrado muestra conteos correctos.
- Eliminar (en negocio de prueba) borra cuenta y datos; no quedan filas huérfanas; auditado.

**DoD:** verde móvil/desktop; **probar borrado solo en negocio de prueba**; `vitest`/`build`;
commit.

---

### Fase 7 — **Historial de pagos** (usuario + admin)
**Objetivo:** usuario y admin consultan el historial de pagos del Premium.

**Backend:** `get_my_payments()` (owner/equipo) y reutilizar `admin_get_business_detail`.

**Frontend:**
- Usuario: en `PlansPanel`/Configuración, sección **"Historial de pagos"** (`ResponsiveListing`):
  fecha, ciclo, importe, método, referencia, período.
- Admin: historial dentro de `BusinessDetailDialog`.
- (Opcional) exportar PDF/Excel reusando la infra existente (feature `reports_export`).

**Escenarios de prueba:** owner ve sus pagos; miembro con permiso de config los ve; otro negocio
no; admin ve por negocio. Mobile/desktop sin overflow.

**DoD:** verde; `vitest`/`build`; commit.

---

### Fase 8 — QA integral, seguridad y documentación
**Objetivo:** cerrar el ciclo completo end-to-end y endurecer.

- Recorrer **todos** los escenarios combinados (compra anual → uso → aviso → gracia → bloqueo →
  pasar a Free o renovar; suspensión; borrado).
- `get_advisors` (security/perf) sobre las nuevas tablas/RPCs; revisar RLS y `search_path`.
- Confirmar **auditoría** de cada acción admin (registrar pago, cambiar fecha, suspender, eliminar,
  aprobar/rechazar) en `audit_logs`.
- Actualizar `CLAUDE.md` (sección de planes), este documento y memoria del proyecto.

**DoD:** suite verde; advisors sin nuevos hallazgos críticos; docs al día; commit.

---

## 4. Matriz de archivos (referencia rápida)

**Backend (migraciones nuevas, prefijo de fecha):**
- F1 `…_pagos_f1_pricing_payments_state.sql`
- F3 `…_pagos_f3_account_status_lifecycle_cron.sql`
- F4 `…_pagos_f4_request_billing_cycle.sql`
- F5 `…_pagos_f5_admin_business_rpcs.sql`
- F6 `…_pagos_f6_admin_team_delete_rpcs.sql`

**Frontend nuevo:**
- `src/components/common/PaymentReminderBanner.jsx` (F2)
- `src/components/auth/AccountGate.jsx`, `AccountBlockedDialog.jsx` (F3)
- `src/components/admin/BusinessesTable.jsx`, `BusinessDetailDialog.jsx`,
  `SetPaymentDateDialog.jsx`, `RecordPaymentDialog.jsx` (F5)
- `src/components/admin/TeamMembersAdminTable.jsx`, `ConfirmDeleteUserDialog.jsx` (F6)
- `src/components/config/PaymentHistory.jsx` (F7)
- `src/services/billing.js` (estado/pagos), ampliaciones en `planRequests.js`.

**Frontend modificado:**
- `src/context/SubscriptionContext.jsx` (F2/F3), `src/layouts/SidebarLayout.jsx` (F2),
  `src/App.jsx` (F3, gate), `src/components/config/PlansPanel.jsx` (F2/F4/F7),
  `src/pages/AdminPlans.jsx` (F5/F6).

---

## 5. Riesgos y mitigaciones
- **Cambio de comportamiento P1.10** (gracia/bloqueo en vez de free silencioso): documentar y
  cubrir con pruebas; el gate debe fallar "cerrado" solo para owner bloqueado, nunca dejar fuera a
  usuarios válidos (resiliencia offline: si no se puede leer estado, **no** bloquear).
- **Borrado permanente:** irreversible → previsualización + confirmación por email + auditoría;
  probar solo en negocio de prueba.
- **RLS:** toda lectura admin por RPC SECURITY DEFINER gated; nunca exponer datos cross-negocio a
  clientes normales.
- **Offline (Capa B):** el gate y el banner deben degradar con gracia sin conexión (no bloquear
  por fallo de red).

## 6. Pruebas mínimas por sesión (recordatorio)
`npx vitest run` (no usar `--reporter=basic`), `npm run build`, y **localhost** con Preview MCP a
ancho móvil (~375px) y desktop. Commit solo si todo pasa; luego entregar el prompt de la siguiente
sesión.
