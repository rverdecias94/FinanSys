# Panel Admin para Gestionar Solicitudes Premium

## Objetivo

Este documento deja definido el diseno futuro del panel administrativo para gestionar cambios de plan en NexGest ERP / GESTIA.

La app esta pensada para Cuba, por lo que el cambio de plan no debe depender obligatoriamente de pagos reales dentro de la aplicacion, Stripe ni pasarelas similares. El flujo recomendado es:

1. El propietario del negocio solicita Premium desde `Configuracion > Planes`.
2. La solicitud queda registrada en Supabase.
3. Un administrador del sistema valida el pago o acuerdo comercial fuera de la app.
4. El administrador aprueba o rechaza la solicitud.
5. Al aprobar, el negocio pasa a Premium por un periodo definido.
6. Al vencer el periodo, el sistema puede volver el negocio a Free.

La primera version puede aprobarse desde Supabase mediante RPC. El panel admin descrito aqui seria una mejora posterior para hacerlo desde la propia interfaz.

## Estado Actual del Proyecto

El proyecto ya tiene una base avanzada para planes:

- `src/context/SubscriptionContext.jsx`
  - Carga `subscriptions`.
  - Carga limites desde `plans`.
  - Expone `checkLimit`, `canAccessFeature`, `updatePlan`, `isPremium`.

- `src/components/config/PlansPanel.jsx`
  - Muestra plan Free y Premium.
  - Actualmente permite cambiar plan desde frontend.

- `src/context/BusinessContext.jsx`
  - Resuelve `businessId`.
  - El plan debe pertenecer al negocio, no al usuario miembro.

- `supabase/migrations/20260213_plans_and_teams.sql`
  - Crea `plans`, `subscriptions`, `team_members`, `usage_metrics`, `audit_logs`.

- `supabase/migrations/plan_limits_enforcement_and_downgrade.sql`
  - Agrega enforcement de limites.
  - Agrega `plan_locked` para areas de inventario.
  - Aplica politicas al cambiar de plan:
    - En Free bloquea areas extra.
    - Revoca socios activos.
    - Deja una sola moneda activa.
    - En Premium desbloquea areas.

## Problema que Resuelve el Panel Admin

No se debe permitir que cualquier propietario active Premium con un boton desde el cliente, porque eso seria editable desde navegador/devtools.

El panel admin debe centralizar estas operaciones:

- Ver solicitudes pendientes.
- Revisar datos de contacto y referencia de pago.
- Aprobar Premium por una duracion.
- Rechazar solicitudes.
- Cancelar o bajar a Free un negocio.
- Extender Premium.
- Ver historial de cambios.

## Modelo de Datos Recomendado

### Tabla: `plan_change_requests`

Registra solicitudes de upgrade/downgrade iniciadas desde la app.

```sql
create table if not exists public.plan_change_requests (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references auth.users(id) on delete cascade,
  requested_by uuid not null references auth.users(id) on delete cascade,
  requested_plan_id text not null references public.plans(id),
  current_plan_id text,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  requested_months integer not null default 1 check (requested_months > 0),
  contact_phone text,
  contact_email text,
  payment_method text,
  payment_reference text,
  user_notes text,
  admin_notes text,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

Indices recomendados:

```sql
create index if not exists idx_plan_change_requests_business
on public.plan_change_requests (business_id);

create index if not exists idx_plan_change_requests_status_created
on public.plan_change_requests (status, created_at desc);
```

Regla importante:

- Un negocio no deberia tener mas de una solicitud `pending` al mismo tiempo.

```sql
create unique index if not exists idx_plan_change_requests_one_pending_per_business
on public.plan_change_requests (business_id)
where status = 'pending';
```

### Cambios recomendados en `subscriptions`

La tabla `subscriptions` deberia guardar informacion de aprobacion manual.

```sql
alter table public.subscriptions
add column if not exists source text not null default 'manual',
add column if not exists approved_by uuid references auth.users(id),
add column if not exists approved_at timestamptz,
add column if not exists cancelled_by uuid references auth.users(id),
add column if not exists cancelled_at timestamptz,
add column if not exists admin_notes text;
```

Campos esperados:

- `plan_id`: `free` o `premium`.
- `status`: `active`, `trial`, `past_due`, `cancelled`, segun se decida mantener.
- `current_period_start`: inicio del periodo Premium.
- `current_period_end`: vencimiento del Premium.
- `source`: `manual`, `stripe`, `trial`, `admin`.
- `approved_by`: admin que aprobo.
- `approved_at`: fecha de aprobacion.

## Seguridad y Roles Admin

Hay dos caminos posibles para identificar administradores del sistema.

### Opcion A: Tabla `system_admins`

Recomendada para este proyecto.

```sql
create table if not exists public.system_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'admin'
    check (role in ('admin', 'support', 'super_admin')),
  created_at timestamptz not null default now()
);
```

Funcion:

```sql
create or replace function public.is_system_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
set row_security = off
as $$
  select exists (
    select 1
    from public.system_admins sa
    where sa.user_id = auth.uid()
  );
$$;
```

Ventaja:

- No mezcla administradores del sistema con propietarios de negocios.
- Mas facil de controlar.
- Evita depender de permisos del negocio (`team.manage`, `config.edit`, etc.).

### Opcion B: Usar `profiles.role = 'admin'`

No recomendada como solucion final, porque `profiles` parece venir de una etapa anterior del proyecto y puede confundirse con roles del negocio.

## RLS Recomendada

### `plan_change_requests`

Reglas deseadas:

- El propietario puede crear y ver solicitudes de su propio negocio.
- Los miembros del equipo pueden ver solicitudes si tienen permiso `config.view`, pero no aprobar.
- Solo system admins pueden aprobar/rechazar/cancelar desde el panel admin.

Ejemplo:

```sql
alter table public.plan_change_requests enable row level security;

create policy plan_change_requests_owner_read
on public.plan_change_requests
for select
using (
  auth.uid() = business_id
  or public.is_member_of_team(business_id)
  or public.is_system_admin()
);

create policy plan_change_requests_owner_insert
on public.plan_change_requests
for insert
with check (
  auth.uid() = business_id
  and requested_by = auth.uid()
);

create policy plan_change_requests_admin_update
on public.plan_change_requests
for update
using (public.is_system_admin())
with check (public.is_system_admin());
```

Aunque exista RLS, las aprobaciones deben hacerse por RPC para centralizar reglas.

## RPCs Recomendadas

### `request_plan_change`

Usada por el propietario desde `PlansPanel`.

Parametros:

- `target_plan_id text`
- `requested_months integer`
- `contact_phone text`
- `payment_method text`
- `payment_reference text`
- `user_notes text`

Responsabilidades:

- Validar autenticacion.
- Obtener `businessId` con `get_current_business_id()`.
- Exigir que `auth.uid() = businessId`, es decir, solo owner.
- Rechazar si ya hay solicitud pendiente.
- Insertar en `plan_change_requests`.
- Registrar auditoria.

Respuesta esperada:

```json
{
  "request_id": "uuid",
  "status": "pending"
}
```

### `approve_plan_change_request`

Usada por system admin.

Parametros:

- `request_id uuid`
- `approved_months integer`
- `admin_notes text`

Responsabilidades:

- Validar `is_system_admin()`.
- Buscar solicitud `pending`.
- Actualizar `subscriptions` del `business_id`.
- Poner:
  - `plan_id = requested_plan_id`
  - `status = 'active'`
  - `current_period_start = now()`
  - `current_period_end = now() + approved_months`
  - `source = 'manual'`
  - `approved_by = auth.uid()`
  - `approved_at = now()`
- Marcar solicitud como `approved`.
- Disparar triggers existentes de cambio de plan.
- Registrar auditoria.

### `reject_plan_change_request`

Usada por system admin.

Parametros:

- `request_id uuid`
- `admin_notes text`

Responsabilidades:

- Validar `is_system_admin()`.
- Marcar solicitud como `rejected`.
- No tocar `subscriptions`.
- Registrar auditoria.

### `admin_set_business_plan`

Funcion opcional para casos especiales.

Parametros:

- `target_business_id uuid`
- `target_plan_id text`
- `months integer`
- `admin_notes text`

Uso:

- Activar Premium manualmente sin solicitud previa.
- Bajar a Free por soporte.
- Extender Premium.

Debe estar restringida exclusivamente a system admins.

## Pantallas del Panel Admin

Ruta sugerida:

```txt
/admin/planes
```

Tambien podria agregarse al sidebar solo si `is_system_admin()` devuelve `true`.

### Vista Principal: Solicitudes de Plan

Componentes:

- `src/pages/AdminPlans.jsx`
- `src/components/admin/PlanRequestsTable.jsx`
- `src/components/admin/PlanRequestDetailsDialog.jsx`
- `src/components/admin/ApprovePlanRequestDialog.jsx`
- `src/components/admin/RejectPlanRequestDialog.jsx`

Columnas recomendadas:

- Fecha.
- Negocio.
- Email del solicitante.
- Plan solicitado.
- Plan actual.
- Meses solicitados.
- Telefono.
- Metodo de pago.
- Referencia.
- Estado.
- Acciones.

Filtros:

- Estado: `pending`, `approved`, `rejected`, `cancelled`.
- Plan solicitado.
- Rango de fecha.
- Busqueda por email/telefono/referencia.

Acciones:

- Ver detalles.
- Aprobar.
- Rechazar.
- Copiar contacto.
- Abrir negocio.

### Dialogo de Aprobacion

Campos:

- Duracion aprobada en meses.
- Fecha de inicio, por defecto hoy.
- Fecha de vencimiento calculada.
- Nota administrativa.

Boton:

- `Aprobar Premium`

Validaciones:

- Solo solicitudes `pending`.
- `approved_months > 0`.
- Confirmar si el negocio ya es Premium.

### Dialogo de Rechazo

Campos:

- Motivo o nota administrativa.

Boton:

- `Rechazar solicitud`

## Servicios Frontend Recomendados

Crear:

```txt
src/services/planRequests.js
```

Funciones:

```js
export async function requestPlanChange(payload)
export async function listPlanChangeRequests(filters)
export async function approvePlanChangeRequest({ requestId, approvedMonths, adminNotes })
export async function rejectPlanChangeRequest({ requestId, adminNotes })
export async function isSystemAdmin()
```

Para la primera fase sin panel admin, solo seria necesario:

```js
export async function requestPlanChange(payload)
```

El panel futuro reutilizaria el resto.

## Cambios en `SubscriptionContext`

Estado futuro deseado:

- `updatePlan('premium')` no debe ser usado por usuarios normales.
- Para Premium, usar `requestPlanChange`.
- Para downgrade a Free, se puede permitir al owner si se confirma claramente.

Funciones sugeridas:

```js
const requestPremium = async ({ requestedMonths, contactPhone, paymentMethod, paymentReference, userNotes }) => {}
const downgradeToFree = async () => {}
```

`updatePlan` podria quedar interno o renombrarse para evitar confusion:

```js
const adminUpdatePlan = async (planId) => {}
```

Pero no debe exponerse a componentes normales si permite activar Premium.

## Cambios en `PlansPanel`

Estado actual:

- Boton `Actualizar a Premium` llama `updatePlan('premium')`.

Estado deseado:

- Boton `Solicitar Premium`.
- Abre modal de solicitud.
- El modal llama `requestPremium`.
- Si ya hay solicitud pendiente, mostrar:
  - `Solicitud pendiente`
  - fecha
  - contacto registrado

Para Free:

- Si el usuario esta en Premium, mostrar `Cambiar a Gratuito`.
- Antes de bajar a Free mostrar confirmacion:
  - Se bloquearan areas por encima del limite.
  - Se revocaran socios.
  - Se dejara una sola moneda activa.
  - Se desactivaran funciones Premium.

## Integracion con Sidebar

Archivo probable:

```txt
src/layouts/SidebarLayout.jsx
```

Agregar item admin solo si:

```js
const { data: isAdmin } = useQuery({
  queryKey: ['isSystemAdmin'],
  queryFn: isSystemAdmin
})
```

Ruta:

```jsx
<Route path="/admin/planes" element={<ProtectedRoute systemAdminOnly />}>
  <Route index element={<AdminPlans />} />
</Route>
```

Se puede extender `ProtectedRoute.jsx` para aceptar:

```js
systemAdminOnly
```

## Vencimiento Automatico de Premium

Debe existir un mecanismo para bajar a Free cuando `current_period_end < now()`.

Opciones:

### Opcion A: Funcion SQL manual

```sql
select public.expire_past_due_subscriptions();
```

Se ejecuta manualmente desde Supabase.

### Opcion B: Scheduled Function / Cron

Mejor a futuro.

Responsabilidades:

- Buscar suscripciones Premium activas vencidas.
- Cambiar a Free.
- El trigger `on_subscription_plan_changed` aplicara politicas de downgrade.

Ejemplo conceptual:

```sql
update public.subscriptions
set plan_id = 'free',
    status = 'cancelled',
    updated_at = now()
where plan_id = 'premium'
  and current_period_end is not null
  and current_period_end < now();
```

## Auditoria

Eventos que deben registrarse siempre, incluso en Free:

- Solicitud Premium creada.
- Solicitud aprobada.
- Solicitud rechazada.
- Cambio manual de plan.
- Downgrade automatico por vencimiento.
- Downgrade voluntario.

Tabla:

```txt
audit_logs
```

Campos relevantes ya usados:

- `business_id`
- `actor_id`
- `user_id`
- `user_email`
- `action`
- `resource`
- `details`
- `area`

Area sugerida:

```txt
Planes
```

## Estados de UI

### Usuario Free sin solicitud

Mostrar:

- Plan actual: Gratuito.
- Boton: `Solicitar Premium`.

### Usuario Free con solicitud pendiente

Mostrar:

- Badge: `Solicitud pendiente`.
- Fecha de solicitud.
- Mensaje: `Revisaremos tu solicitud y te contactaremos.`
- Boton secundario opcional: `Cancelar solicitud`.

### Usuario Premium activo

Mostrar:

- Plan actual: Premium.
- Fecha de vencimiento si existe.
- Boton: `Cambiar a Gratuito`.

### Usuario Premium vencido

Si aun no corrio el cron:

- Mostrar alerta: `Tu Premium vencio`.
- Restringir funciones segun backend cuando se ejecute vencimiento.

## Orden Recomendado de Implementacion Futura

1. Crear tabla `system_admins`.
2. Crear `is_system_admin()`.
3. Crear `plan_change_requests`.
4. Crear RPCs:
   - `request_plan_change`
   - `approve_plan_change_request`
   - `reject_plan_change_request`
5. Cambiar `PlansPanel` para solicitar Premium.
6. Crear servicio `src/services/planRequests.js`.
7. Crear pagina `AdminPlans.jsx`.
8. Agregar ruta `/admin/planes`.
9. Agregar item condicional en sidebar.
10. Agregar vencimiento automatico.
11. Agregar tests/manual QA.

## QA Manual

Casos minimos:

- Owner Free puede solicitar Premium.
- Miembro de equipo no puede solicitar Premium.
- Owner no puede crear dos solicitudes pendientes.
- Usuario no admin no puede aprobar solicitudes.
- Admin aprueba solicitud y el negocio pasa a Premium.
- Al aprobar se desbloquea Equipo, Roles, multiples monedas, exportaciones y logs.
- Admin rechaza solicitud y el negocio sigue en Free.
- Downgrade a Free bloquea areas extra, revoca socios y deja una sola moneda activa.
- Solicitudes y aprobaciones quedan en auditoria.

## Notas Sobre Stripe

Stripe no debe bloquear este diseno. Si algun dia se puede usar Stripe legalmente mediante una entidad en un pais soportado, el panel admin y las tablas siguen siendo utiles.

En ese caso:

- `plan_change_requests` seguiria sirviendo para pagos manuales.
- `subscriptions.source` podria ser `stripe`.
- Los webhooks de Stripe actualizarian `subscriptions`.
- El panel admin serviria para soporte, revisiones y cambios manuales excepcionales.

## Decision Recomendada

Para Cuba, la implementacion inicial debe ser:

- Solicitud Premium manual.
- Aprobacion por RPC desde Supabase.
- Panel admin como fase posterior.

Esto evita construir demasiada interfaz antes de validar el flujo real de cobro y soporte.
