# PLAN — Prioridades 1 y 2: Cashbook sólido y honesto (GESTIA)

> **Origen:** Auditoría "21 mandamientos" (council adversarial sobre código y BD reales, 2026-06-21/22).
> **Objetivo:** convertir GESTIA de un cashbook básico a un **gestor de caja sólido y honesto**,
> conectando Finanzas↔Almacén↔Inventario para eliminar la doble captura manual, sin convertirlo en ERP.
> **Apetito de complejidad fijado por Roberto: 8/21** (cashbook sólido, no ERP).
> **Público:** Cuba (efectivo, informal) + clientes extranjeros informales en crecimiento.
> **Estado:** PLAN aprobado en alcance. Ejecutar por sesiones, en ramas, con tests y verificación en localhost.

---

## 0. Decisiones tomadas (cierran el alcance)

| Bifurcación | Decisión | Implica |
|---|---|---|
| Profundidad de costeo | **Promedio Ponderado (WAC) + COGS + margen** | Venta descuenta stock y sella costo; utilidad real por venta/producto. Cumple Q4 y Q21 (margen bruto). |
| Terminología que sobre-promete | **Limpieza completa** | UI, menús, selector FIFO cosmético, narrativa de reportes, README, manifest PWA y docs internas. |
| Infraestructura | **Ramas + tests locales + migraciones reversibles** | Sin CI/staging por ahora. **Excepción: rotar secretos filtrados ya.** |

**FUERA de scope (explícito, por decisión y por contexto Cuba):**
- Partida doble / plan de cuentas / libro mayor (Q1, Q6).
- Factura como documento fiscal con motor de impuestos + e-factura (Q7 completo).
- Nota de crédito fiscal formal (Q8 completo) — *sí* haremos "reversa/devolución" simple.
- **FIFO / UEPS por capas y documentos de valuación tipo Kardex por método (Q9).** Implementamos
  Promedio Ponderado como **cálculo interno de costo**, no como "documento de valuación" seleccionable.
- ROP dinámico con lead time/desviación (Q14) — se mantiene `min_stock` fijo.
- Presupuestos vs Real + escenarios (Q18).
- Centros de costo / proyectos (Q11).
- API documentada / webhooks (Q20).
- Asignación de costos **indirectos** (fletes/comisiones/almacenaje) al margen (parte de Q21) — solo margen **bruto**.
- Ganancia/pérdida cambiaria **no realizada** (revaluación al cierre) — opcional/stretch.

---

## 1. Verdad de terreno verificada (no suposiciones)

Hechos confirmados en la BD viva (Supabase) y el código, que **corrigen** supuestos previos:

1. **Volúmenes minúsculos → ventana ideal para reestructurar:** `transactions=4`, `contacts=1`,
   `products=0`, `movements=0`, `inventory_items=0`, `audit_logs=116`, `business_balances=3`,
   `business_currencies=4`. Las migraciones estructurales son **de muy bajo riesgo hoy**.
2. **El saldo SÍ tiene trigger, pero apunta a la tabla equivocada:** existe
   `on_transaction_balance_update` (AFTER INSERT/UPDATE/DELETE) → `handle_transaction_balance_update()`,
   pero **escribe en `configuracion_balance` (LEGADA, 0 filas) y solo USD/CUP hardcodeados**. La app lee
   `business_balances` (multimoneda, 3 filas), que **solo se recalcula al guardar config**
   (`finanzas.js` `updateBalanceConfig`). → Bug latente de saldo desactualizado en multimoneda.
3. **Colisión de nombre:** ya existe tabla `public.payments` para **facturación del SaaS/suscripciones**
   (`request_id` → `plan_change_requests`). El libro de abonos de CxC/CxP **no** puede llamarse `payments`
   → usaremos **`account_payments`**.
4. **`contacts.is_active` ya existe** (default true) → el soft-delete es trivial.
5. **`register_stock_movement(p_product_id,p_qty,p_type)`** es atómica y segura (lock de fila,
   `stock>=p_qty`, permiso `warehouse.move`, `get_current_business_id()`), pero **no maneja costo ni fecha**
   (usa `now()`), y `movements` no tiene `transaction_id` ni `unit_cost`. `products` no tiene `avg_cost`.
6. **`transactions`** tiene `details jsonb`, `fx_units_per_base` (tasa sellada por operación, hoy **nunca leída**),
   y CxC/CxP por columnas (`status`, `due_date`, `paid_amount` escalar).
7. **`audit_logs`** tiene `details jsonb` pero **no `old_value`/`new_value`**; el logger es Premium-only y
   *fire-and-forget* (`auditLogger.js`).
8. **RLS habilitado en todas las tablas.** Advisors: predominan avisos de exposición GraphQL (mitigados por RLS)
   y `SECURITY DEFINER` ejecutables por anon/authenticated; un WARN real: **leaked password protection desactivada**.
9. **Infra:** sin CI, sin `supabase/config.toml` (migraciones aplicadas a mano por MCP `apply_migration`),
   un solo entorno (prod). 7 migraciones sin prefijo de fecha. **Secretos reales dentro de
   `.env.tooling.example` versionado** (password BD prod, GitHub PAT, Netlify token).

---

## 2. Meta de puntaje (honesta) tras P1+P2

**Compromiso firme (8/21 — todos SÍ verificables):**

| # | Mandamiento | Cómo se cumple |
|---|---|---|
| Q2 | Pagos parciales + historial | Tabla `account_payments` (libro de abonos) + RPC atómica |
| Q3 | No borrar contacto con histórico | Soft-delete con `is_active` |
| Q4 | Costo promedio ponderado en tiempo real | `products.avg_cost` recomputado en cada entrada |
| Q5 | Estados financieros | Resumen Ingresos/Gastos + **Flujo de Efectivo** + **Posición simplificada** |
| Q10 | Antigüedad de saldos | RPC con tramos por-vencer/1-30/31-60/61-90/+90 |
| Q12 | Multiusuario sin pisarse | Saldo atómico vía trigger correcto + venta vía RPC única |
| Q16 | Auditoría antes/después | Triggers de auditoría con `old_value`/`new_value` |
| Q17 | Cierre de período | `period_locks` + guards en BD + reapertura trazable |

**Stretch alcanzable (subiría a ~11/21):** Q15 (drill-down), Q21 (margen **bruto**), Q13 (FX **realizada**),
Q19 (campos personalizados en más entidades), reversa de venta (parte de Q8).

---

## 3. Principios de ingeniería (cómo trabaja un equipo profesional)

1. **Una rama por entrega.** `feat/<area>-<corto>` saliendo de `main`. Nunca commit directo a `main`.
   Conventional Commits (ya es la convención del repo). Un "PR" = auto-revisión + checklist antes de merge.
2. **Gate manual obligatorio antes de merge** (sustituye al CI ausente):
   `npm run lint` ✅ · `npm run test:run` ✅ (añadir script) · `npm run build` ✅ · verificación en localhost
   **móvil + desktop** (Preview MCP `preview_resize`).
3. **Migraciones expand/contract, idempotentes y reversibles:**
   - **Fase expand:** solo aditivo (`ADD COLUMN ... DEFAULT`, `CREATE TABLE IF NOT EXISTS`, nuevas RPC,
     nuevos triggers). El código viejo sigue funcionando sin cambios → **cero downtime**.
   - **Despliegue de código** que usa lo nuevo.
   - **Fase contract** (otra migración, días después): recién ahí se retira lo viejo (drop de columnas/triggers
     muertos) cuando nada los usa.
   - Cada migración trae su **bloque de rollback** comentado al final (down manual).
   - Idempotencia: `IF NOT EXISTS` / `CREATE OR REPLACE` / `DROP ... IF EXISTS`.
   - Aplicar **primero** revisada en el editor; aplicar a prod por `apply_migration` solo tras tests verdes.
     (Dado el volumen ~0, el riesgo real es mínimo; aun así, disciplina.)
4. **Toda lógica que cruce integridad va a RPC `SECURITY DEFINER` anclada en `get_current_business_id()`**
   (patrón ya usado en `register_stock_movement`/`create_inventory_item`). Nunca confiar el `business_id` del cliente
   en operaciones atómicas.
5. **Defensa en profundidad:** el guard de negocio (cierre de período, permisos) va en **BD** (trigger/RPC),
   no solo en cliente.
6. **Tests primero donde hay hueco:** crear `src/tests/_supabaseMock.js` (helper compartido) y cubrir cada
   servicio/RPC nueva + regresión de los flujos existentes (saldo, stock).
7. **Verificación visual real** (regla dura del proyecto): cada botón/acción nueva se prueba en localhost a
   ancho móvil (~390px) y desktop antes de marcar ✅.

---

## 4. Track 0 — Pre-flight (seguridad e higiene, antes de tocar features)

**T0.1 — Rotar secretos filtrados (URGENTE, fuera de feature work).**
`.env.tooling.example` (versionado, repo público `FinanSys`) contiene credenciales **vivas**:
`SUPABASE_DB_PASSWORD`, connection string, `GITHUB_TOKEN` (PAT), `NETLIFY_AUTH_TOKEN`.
- Rotar **cada** secreto en su panel (Supabase → DB password; GitHub → revocar PAT; Netlify → revocar token).
- Reemplazar valores en `.env.tooling.example` por **placeholders** (`<your-...>`).
- Confirmar que `.env.tooling` real está en `.gitignore` (lo está). Considerar limpieza de historial
  (BFG/`git filter-repo`) — opcional; lo crítico es que los secretos rotados queden inservibles.
- *No bloquea el resto, pero es lo primero.*

**T0.2 — Arreglar los 2 tests rotos** de `src/components/config/PlansPanel.test.jsx`
(selector `getByRole('button',{name:'Solicitar Premium'})` ambiguo). Un rojo permanente entrena al equipo a
ignorar el rojo. Hacer el selector único (p. ej. `getAllByRole`/`within`/`data-testid`).

**T0.3 — Tooling de calidad mínimo:**
- `package.json`: añadir `"test:run": "vitest run"` y `"test:cov": "vitest run --coverage"`.
- Crear `src/tests/_supabaseMock.js`: helper único para mockear `@/config/supabase` (hoy cada test lo hace ad-hoc).
- Activar `auth_leaked_password_protection` en Supabase Auth (1 clic, sin código).

**Rama:** `chore/preflight-seguridad-calidad`. **Riesgo:** nulo (no toca esquema ni flujos).

---

## 5. Track 4 — Terminología honesta (limpieza completa) · *en paralelo, bajo riesgo*

Se hace pronto porque es UI/texto (sin esquema) y elimina promesas falsas ya visibles. **Rama:** `refactor/terminologia-honesta`.

| Zona | Cambio | Archivo(s) |
|---|---|---|
| Identidad | Quitar "ERP"/"Contabilidad"/"Sistema Contable" del producto | `README.md`, `src/pages/Login.jsx` ("Bienvenido a tu Sistema Contable"), `vite.config.js` (manifest PWA "…contable") |
| Menús | "Auditoría" → **"Bitácora"/"Registro de actividad"** | `src/layouts/SidebarLayout.jsx`, `src/pages/LogsMejorado.jsx`, `src/components/dashboard/DashboardPermissions.jsx` |
| **Selector cosmético** | **Eliminar** el selector "Método de Valoración PEPS/FIFO/Promedio" (no hace nada). Tras Track 2, el costo es automático (WAC), sin elección de usuario. | `src/components/config/general/BalanceBaseSection.jsx`, `businessSettings.js`, `OnboardingWizard.jsx`; `business_settings.valuation_method` queda sin uso → retirar en fase contract |
| Reportes | "Estado de Resultados" → **"Resumen de Ingresos y Gastos"**; quitar "ejercicio/superávit/déficit/partida/valoración/moneda funcional" | `src/utils/narrativeGenerator.js` |
| Config | "…para la contabilidad del negocio" / "Datos obligatorios para facturas" → textos honestos de caja/reportes | `BalanceBaseSection.jsx`, `BusinessProfileSection.jsx` |
| README/marketing | Quitar "tiempo real", "profesional", "trazabilidad completa", "rastrear cambios", "Balance riguroso" | `README.md` |
| Docs internas | Corregir `docs/PLAN_DE_TRABAJO.md` ("exactitud contable hecha" → "exactitud de caja"); alinear `CLAUDE.md` | `docs/`, `CLAUDE.md` |

**Nota de orden:** el texto del módulo "Auditoría" se renombra ahora, pero la **función** real de antes/después
llega en Track 1 (S4). Así el nombre y el comportamiento quedan alineados al final de P1.

**Riesgo:** bajo. Único cuidado: el permiso/área interna sigue siendo `logs.*` (no renombrar códigos de permiso ni
rutas para no romper RBAC; solo etiquetas visibles).

---

## 6. Track 1 — Integridad de datos (Prioridad 1)

### S1 · Soft-delete de contactos (Q3) — **rama `feat/contactos-soft-delete`**
- **BD:** ninguna (la columna `contacts.is_active` ya existe). *(Opcional: índice parcial `(user_id) where is_active`.)*
- **Código:** `src/services/contacts.js` → `deleteContact` hace `UPDATE is_active=false` (no `DELETE`);
  `listContacts` filtra `.eq('is_active', true)`. RLS: el soft-delete pasa a ser UPDATE → requiere permiso
  `finanzas.edit` (no `finanzas.delete`); ajustar policy/uso en `Contactos.jsx` (`ActionButtons module="finanzas"`).
- **UX:** el `ConfirmDialog` deja de decir "no se puede deshacer"; opción "reactivar" para inactivos (stretch).
- **Impacto/riesgo:** `transactions.contact_id` (FK `ON DELETE SET NULL`) deja de huérfanar histórico (mejora).
  Verificar que ningún `listContacts` olvide el filtro (selector en `FinanzasMejorado.jsx`).
- **Tests:** `contacts` no tiene tests hoy → crear `services/contacts.test.js` (soft-delete, filtro de listado).

### S2 · Libro de abonos `account_payments` (Q2) — **rama `feat/cxc-abonos`**
- **BD (expand):**
  ```sql
  create table if not exists public.account_payments (
    id          bigint generated by default as identity primary key,
    user_id     uuid not null default get_current_business_id(),
    transaction_id bigint not null references public.transactions(id) on delete cascade,
    amount      numeric not null check (amount > 0),
    paid_at     timestamptz not null default now(),
    method      text,
    note        text,
    fx_units_per_base numeric,   -- tasa al cobrar (para FX realizada, Q13 stretch)
    created_at  timestamptz not null default now()
  );
  create index if not exists idx_account_payments_tx on public.account_payments(transaction_id);
  -- RLS: replicar patrón de contacts (select/insert/update/delete por user_id = get_current_business_id())
  ```
  - **RPC atómica `register_account_payment(p_transaction_id, p_amount, p_method, p_note)`**: inserta abono +
    recomputa `transactions.paid_amount = LEAST(amount, Σabonos)` y `status` (`paid`/`partial`/`pending`).
    Elimina el read-modify-write actual de `registerPayment` (riesgo de lost-update).
  - `paid_amount` se conserva como **cache derivada** (no romper `listOpenAccounts`/`updateTransaction`).
- **Código:** reescribir `finanzas.js` `registerPayment` → llamar RPC. `CuentasMejorado.jsx`: vista de historial
  de abonos por cuenta. `updateTransaction`/`createTransaction`: el abono inicial se materializa como primera fila.
- **Impacto/riesgo:** doble fuente de verdad si `paid_amount` no se recomputa estrictamente → la RPC es la única vía.
  Migración de datos: las 4 transacciones actuales `paid`/`partial` pueden o no generar abono histórico
  (decisión: generar 1 abono por cada `paid_amount>0` para coherencia).
- **Tests:** abono parcial → `partial`; abono que completa → `paid`; suma de abonos = `paid_amount`; concurrencia
  (dos abonos) no descuadra.

### S3 · Unificar mantenimiento de saldo (Q12) — **rama `feat/saldo-atomico`**
- **Problema:** trigger actual mantiene `configuracion_balance` (legada, USD/CUP) en vez de `business_balances` (multimoneda).
- **BD (expand):**
  - `create unique index if not exists uq_business_balances_user_cur on business_balances(user_id, currency_code);`
  - **Nueva función** `handle_business_balance_update()` que en AFTER INSERT/UPDATE/DELETE de `transactions`
    upserta `business_balances.current_balance` por `(user_id, currency_code)` con el delta firmado
    (income +, expense −), para **cualquier** moneda.
  - **Reseed** único: recomputar `current_balance = initial_balance + Σincome − Σexpense` por moneda (4 filas → trivial).
  - Sustituir el trigger viejo por el nuevo (el legacy queda neutralizado; `configuracion_balance` se retira en contract).
- **Código:** `updateBalanceConfig` deja de ser la única vía de recálculo (sigue válido para fijar `initial_balance`).
  Invalidar query de saldo tras transacciones (hoy no se hace porque no existía dependencia).
- **Impacto/riesgo:** **es el cambio con mayor efecto en exactitud**. Verificar que el reseed cuadre con el saldo
  mostrado hoy. Probar borrar/editar transacción y ver saldo correcto al instante.
- **Tests:** ampliar `finanzas.unit.test.js` y añadir prueba de trigger (income/expense/edición/borrado por moneda).

### S4 · Auditoría antes/después (Q16) — **rama `feat/auditoria-diff`**
- **BD (expand):**
  - `alter table audit_logs add column if not exists old_value jsonb, add column if not exists new_value jsonb;`
  - **Triggers de auditoría a nivel BD** (`SECURITY DEFINER`) sobre `transactions`, `contacts`, `products`,
    `movements`, `account_payments`: capturan `OLD`/`NEW` completos en cada UPDATE/DELETE/INSERT.
    Esto elimina las dos debilidades del logger cliente: **Premium-only** y **fire-and-forget**.
  - Mantener `auditLogger.js` (cliente) para acciones de app no ligadas a fila (login, exportes, etc.).
- **Privacidad (reconciliar con P2.2):** el diff de `transactions` incluye montos → en la UI de Logs el
  `old/new` financiero **se muestra solo a quien tenga `finanzas.view`**; al resto, solo "campos modificados".
- **Código:** `LogsMejorado.jsx` renderiza el diff (tabla antes/después) y lo incluye en la exportación, con gating.
- **Impacto/riesgo:** tamaño de `audit_logs` (dos JSONB) — aceptable al volumen actual; índice ya existe (`p2_3`).
  No romper el flujo si el trigger falla (los triggers de auditoría no deben abortar la operación de negocio →
  envolver en manejo tolerante donde aplique).
- **Tests:** editar transacción → log con `old_value`/`new_value` correctos; gating por permiso.

### S5 · Cierre de período (Q17) — **rama `feat/cierre-periodo`**
- **BD (expand):**
  ```sql
  create table if not exists public.period_locks (
    user_id uuid not null default get_current_business_id(),
    closed_through date not null,
    updated_by uuid, updated_at timestamptz not null default now(),
    primary key (user_id)
  );  -- RLS por user_id
  ```
  - **Guard en BD:** trigger `BEFORE INSERT/UPDATE/DELETE` en `transactions` (y en la RPC de venta) que rechaza
    `date::date <= closed_through` salvo bandera de reapertura. Mensaje claro ("Período cerrado hasta dd/mm").
  - **Reapertura trazable:** RPC `reopen_period(p_through)` que mueve `closed_through` atrás y **registra en
    `audit_logs`** quién/cuándo/por qué. Solo `isOwner`/permiso de config.
- **Código:** `TransactionModal.jsx` (deshabilitar fechas ≤ cierre, `minDate`), `getSupabaseErrorMessage` para el error
  del guard; sección en Configuración para cerrar/reabrir período.
- **Impacto/riesgo:** abonos (`account_payments`) sobre transacciones de período cerrado → **decisión: permitidos**
  (el cobro ocurre hoy, no altera el pasado). `updateBalanceConfig` recalcula todo el histórico → debe respetar que
  no contradiga un período congelado (con S3 el saldo ya es por delta, se mitiga).
- **Tests:** insertar/editar en período cerrado → rechazo; reapertura registra auditoría; abono permitido.

---

## 7. Track 2 — Conexión Finanzas↔Almacén↔Inventario (Prioridad 2, núcleo)

> El cambio más invasivo y el corazón de tu petición ("operaciones automáticas, sin doble captura").
> Se hace **después** de S3 (saldo atómico) porque la venta toca saldo y stock a la vez.

### S6 · Esquema de costo + WAC en entradas (Q4) — **rama `feat/costeo-wac`**
- **BD (expand):**
  - `alter table products add column if not exists avg_cost numeric not null default 0;`
  - `alter table movements add column if not exists unit_cost numeric;`
  - `alter table movements add column if not exists transaction_id bigint references transactions(id) on delete set null;`
  - `alter table movements add column if not exists moved_at timestamptz not null default now();` (fecha de negocio,
    hoy solo hay `created_at`; necesaria para costo/cierre retroactivo).
  - **Ampliar `register_stock_movement`** con `p_unit_cost numeric default null` (backward-compatible; los 3 params
    actuales siguen válidos). En entradas (`in`) con costo: recomputar
    `avg_cost = (avg_cost*stock_old + p_unit_cost*p_qty) / (stock_old + p_qty)` **atómicamente**; guardar `unit_cost`
    en el movimiento. En salidas: sellar `unit_cost = avg_cost` actual (COGS).
- **Código:** `MovementModal.jsx` captura **costo unitario** en entradas; `almacen.js` pasa `p_unit_cost`.
  `getAlmacenStats` puede valorar inventario a costo (stretch).
- **Impacto/riesgo:** orden de movimientos importa para WAC; movimientos retroactivos complican el promedio
  (mitigado: el costo se sella en el momento; no se recalcula hacia atrás).
- **Tests:** entrada a $10 y entrada a $20 → `avg_cost` ponderado; salida sella COGS = avg_cost.

### S7 · Venta conectada (Q12 venta atómica + base Q21) — **rama `feat/venta-conectada`**
- **BD (expand):**
  ```sql
  create table if not exists public.sale_items (
    id bigint generated by default as identity primary key,
    user_id uuid not null default get_current_business_id(),
    transaction_id bigint not null references public.transactions(id) on delete cascade,
    product_id bigint not null references public.products(id),
    qty numeric not null check (qty > 0),
    unit_price numeric not null,   -- precio de venta
    unit_cost  numeric not null,   -- costo sellado (avg_cost al momento) → COGS
    created_at timestamptz not null default now()
  );
  ```
  - **RPC `register_sale(p_payload jsonb, p_items jsonb)`** (`SECURITY DEFINER`, una sola transacción):
    1. valida permisos `finanzas.create` + `warehouse.move`;
    2. valida cierre de período (S5);
    3. inserta la `transactions` (income) — dispara `enforce_transactions_monthly_limit` automáticamente (sin doble conteo);
    4. por cada ítem: descuenta stock (lógica de `register_stock_movement`), inserta `movements` con
       `transaction_id` y `unit_cost=avg_cost`, inserta `sale_items`;
    5. margen bruto = Σ(unit_price−unit_cost)·qty (derivable).
  - Si **cualquier** paso falla, rollback total (resuelve la atomicidad entre dos subsistemas hoy independientes).
- **Código:** `TransactionModal.jsx`: modo "Venta de producto(s)" con selector de productos + cantidades + precio;
  al guardar, llama `register_sale`. Invalidar **ambos** dominios de query: `['transactions','dashboard','filteredTotals']`
  **y** `['warehouse']` (hoy ningún flujo invalida los dos).
- **Impacto/riesgo (alto):** mezcla de resolución de negocio (cliente vs `get_current_business_id()`) → la RPC ancla
  todo server-side. Definir que se vende **`products` (Almacén)**, no `inventory_items` (inventario dinámico es catálogo,
  no stock costeable). Compatibilidad: una transacción **sin** ítems sigue siendo un movimiento de caja normal (no rompe lo existente).
- **Tests:** venta descuenta stock y crea COGS; venta con stock insuficiente → rollback (no crea transacción);
  venta respeta límite mensual y cierre de período.

### S8 · Reversa/edición de venta + margen (parte Q8 y Q21) — **rama `feat/venta-reversa-margen`**
- **RPC `reverse_sale(p_transaction_id)`**: repone stock (entrada por cada ítem, sin alterar `avg_cost` o
  recomputando según política), marca la transacción como anulada/devuelta y registra auditoría. *Devolución simple*
  (no nota de crédito fiscal).
- **Margen bruto:** reporte/columna "Utilidad" por venta y por producto (Σ precio − Σ costo). Honesto: **margen bruto**,
  no margen de contribución con indirectos.
- **Tests:** reversa repone stock exacto y revierte saldo; doble reversa no duplica.

---

## 8. Track 3 — Reportes e insight (Prioridad 2)

### S9 · Antigüedad de saldos (Q10) — **rama `feat/aging`**
- **RPC `get_aging_report(p_direction text)`** (CxC = income pending/partial; CxP = expense pending/partial):
  clasifica por `due_date` vs `current_date` en **por vencer / 1-30 / 31-60 / 61-90 / +90**, con saldo
  (`amount − paid_amount`). En tiempo real vía React Query (invalidar tras abonos).
- **Código:** sección en `CuentasMejorado.jsx` o `Reportes.jsx` con tabla por tramos + totales + export.
- **Tests:** clasificación correcta por días; saldo = amount − Σabonos.

### S10 · Flujo de Efectivo + Posición simplificada (Q5) — **rama `feat/estados-flujo-posicion`**
- **Flujo de Efectivo** (base caja: entradas/salidas por período y moneda) — trivial sobre `transactions`.
- **Posición simplificada** = saldos de `business_balances` + Σ por cobrar − Σ por pagar (no Balance General formal).
- Renombrar narrativa (alineado con Track 4). **Sin** consolidación contable formal.
- **Tests:** flujo cuadra con Σ income/expense del período.

### S11 · Drill-down en reportes (Q15) — **rama `feat/drilldown`** *(stretch)*
- Cifras agregadas **clicables** → navegan/filtran a la lista de transacciones subyacentes (y a la venta/ítems).
  Encaja con tu fortaleza (UX). Es navegación cliente, sin esquema nuevo.

### S12 · FX realizada (Q13) — **rama `feat/fx-realizada`** *(stretch)*
- Usar `transactions.fx_units_per_base` (booking) vs `account_payments.fx_units_per_base` (cobro) →
  ganancia/pérdida cambiaria **realizada** al cobrar en otra tasa. (No realizada/revaluación = fuera de scope.)

---

## 9. Secuencia sugerida (sesiones)

| Orden | Entrega | Track | Riesgo | Depende de |
|---|---|---|---|---|
| 1 | T0 Pre-flight (secretos, tests rotos, tooling) | 0 | nulo | — |
| 2 | Terminología honesta | 4 | bajo | — (paralelo) |
| 3 | S1 Soft-delete contactos | 1 | bajo | — |
| 4 | S3 Saldo atómico (trigger correcto) | 1 | **medio** | — |
| 5 | S2 Libro de abonos | 1 | medio | S3 |
| 6 | S4 Auditoría antes/después | 1 | medio | — |
| 7 | S5 Cierre de período | 1 | medio | S3 |
| 8 | S6 Costeo WAC en entradas | 2 | medio | — |
| 9 | S7 Venta conectada (atómica) | 2 | **alto** | S3, S5, S6 |
| 10 | S8 Reversa + margen | 2 | medio | S7 |
| 11 | S9 Antigüedad de saldos | 3 | bajo | S2 |
| 12 | S10 Flujo + Posición | 3 | bajo | S3 |
| 13 | S11 Drill-down · S12 FX realizada | 3 | bajo | stretch |

> Tras la sesión 9 ya se cumplen los **8/21** comprometidos. Sesiones 10-13 son el "stretch" honesto.

---

## 10. Definición de "Hecho" (por entrega)
- [ ] Rama feature creada desde `main` (nunca commit directo a `main`).
- [ ] Migración expand **idempotente** + bloque de rollback comentado.
- [ ] Código nuevo usa RPC `SECURITY DEFINER` + `get_current_business_id()` donde cruza integridad.
- [ ] `npm run lint` ✅ · `npm run test:run` ✅ (con tests nuevos) · `npm run build` ✅.
- [ ] Verificado en localhost **móvil (~390px) + desktop** (Preview MCP), sin solapes/overflow, campos de igual altura.
- [ ] Saldo/stock cuadran tras crear/editar/borrar (prueba destructiva real con las 4 transacciones de prueba).
- [ ] Terminología de la zona tocada no promete nada que la entrega no haga.
- [ ] (Si aplica) advisors de Supabase re-revisados tras DDL.

---

## 11. Riesgos transversales y mitigaciones
- **Atomicidad cruzada (venta):** única RPC server-side; nunca dos llamadas cliente. *(S7)*
- **Doble fuente de verdad (paid_amount, avg_cost, current_balance):** siempre recomputados por RPC/trigger, nunca por el cliente.
- **Privacidad vs auditoría (P2.2):** diff financiero gateado por `finanzas.view`. *(S4)*
- **Migraciones sin staging:** mitigado por volumen ~0, expand/contract, rollback y verificación local previa.
- **Resolución de negocio inconsistente (cliente vs server):** toda RPC nueva ancla en `get_current_business_id()`.
- **Invalidación de caché incompleta:** la venta debe invalidar Finanzas **y** Almacén.

---

## 12. Decisiones pendientes de Roberto (menores, no bloquean el arranque)
1. Reseed de abonos: ¿generar 1 abono histórico por cada transacción ya `paid`/`partial`, o empezar el libro de abonos en limpio?
2. ¿La reversa de venta repone stock al `avg_cost` del momento de la venta o al actual? (Recomendado: al del momento, sellado en `sale_items.unit_cost`.)
3. ¿Limpiamos el historial de git para purgar los secretos ya rotados, o basta con rotarlos (recomendado: rotar; purga opcional)?
