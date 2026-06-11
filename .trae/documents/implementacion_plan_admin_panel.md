# Implementación: PLAN_ADMIN_PANEL_FUTURO

## Alcance implementado

- Solicitud Premium manual desde `Configuración > Planes`, sin upgrade directo a Premium desde cliente.
- Persistencia en Supabase de solicitudes (`plan_change_requests`) y rol admin de sistema (`system_admins`).
- RPCs para solicitar, aprobar, rechazar y cancelar solicitudes, más ajustes manuales de plan y vencimiento.
- Panel administrativo en `/admin/planes` (solo system admins) para:
  - Ver solicitudes con filtros, abrir detalle, aprobar/rechazar.
  - Ejecutar vencimiento de Premium.
  - Ajustar plan manualmente por `business_id`.
- Pruebas unitarias e “integración” (UI) y verificación por `lint`.

## Base de datos (Supabase)

### Migraciones relevantes

- `supabase/migrations/20260610_manual_plan_change_requests.sql`
  - `public.system_admins`
  - `public.is_system_admin()`
  - `public.plan_change_requests`
  - columnas extra en `public.subscriptions`
  - RLS/policies para `plan_change_requests` y `subscriptions`
  - RPCs: `request_plan_change`, `approve_plan_change_request`, `reject_plan_change_request`, `expire_past_due_subscriptions`

- `supabase/migrations/20260611_admin_plan_panel.sql`
  - RPC owner: `cancel_my_pending_plan_change_request`
  - RPC admin: `admin_set_business_plan`
  - `expire_past_due_subscriptions` se redefine para registrar auditoría por vencimiento

### RPCs disponibles

- `request_plan_change(target_plan_id, requested_months, contact_phone, payment_method, payment_reference, user_notes)`
- `approve_plan_change_request(request_id, approved_months, admin_notes)`
- `reject_plan_change_request(request_id, admin_notes)`
- `cancel_my_pending_plan_change_request()`
- `admin_set_business_plan(target_business_id, target_plan_id, months, admin_notes)`
- `expire_past_due_subscriptions()`

### Auditoría

- Todas las acciones principales insertan registros en `audit_logs` con `area = 'Planes'`.

### Cómo habilitar un system admin

1. Identifica el `auth.users.id` del usuario.
2. Inserta en `public.system_admins`:
   - `user_id = <uuid>`
   - `role = 'admin' | 'support' | 'super_admin'`

## Frontend

### Solicitud Premium

- `src/components/config/PlansPanel.jsx`:
  - Botón “Solicitar Premium” abre modal de solicitud.
  - Si existe solicitud `pending`, muestra banner y permite cancelar.
- `src/context/SubscriptionContext.jsx`:
  - Expone `requestPremium` y `cancelPendingPremiumRequest`.

### Panel Admin

- Ruta: `/admin/planes`
- Protección:
  - `src/routes/ProtectedRoute.jsx` soporta `systemAdminOnly` y valida con `isSystemAdmin()`.
- Sidebar:
  - `src/layouts/SidebarLayout.jsx` muestra “Admin Planes” solo si `isSystemAdmin()` devuelve `true`.

## Servicios

- `src/services/planRequests.js` contiene:
  - `requestPlanChange`, `getPendingPlanRequest`, `cancelMyPendingPlanChangeRequest`
  - `isSystemAdmin`, `listPlanChangeRequests`
  - `approvePlanChangeRequest`, `rejectPlanChangeRequest`
  - `adminSetBusinessPlan`, `expirePastDueSubscriptions`

## Pruebas y verificación

- Ejecutar tests (modo no-watch): `npm test -- --run`
- Ejecutar lint: `npm run lint`

Archivos de tests añadidos:

- `src/services/planRequests.test.js`
- `src/components/config/PlansPanel.test.jsx`
- `src/routes/ProtectedRoute.test.jsx`

