# Pagos Premium — Fase 8 (QA integral)

> **2026-11-10** · Verificaciones automáticas ejecutadas en prod (`obsxmmwrzsaahjmlhtxd`) y tests locales.
> Las pruebas **manuales E2E** las hace Roberto en localhost o prod con cuenta system admin.

## Automatizado (hecho)

| Área | Resultado |
|------|-----------|
| Security advisor Supabase | **0 ERROR** |
| RLS `payments`, `account_status`, `plan_change_requests`, `subscriptions`, `billing_config` | `relrowsecurity = true` |
| RPCs pagos/admin (`get_my_payments`, `admin_*`, `approve/reject_plan_change_request`, `get_effective_plan_state`) | `search_path` fijado |
| Tests unitarios pagos (14 tests) | `adminUsers`, `billing`, `PaymentHistory`, `userManagement`, `AccountGate` — **verde** |
| `npm run build` | Ver salida del último run en sesión F8 |

## Auditoría server-side (RPC)

Acciones admin que **insertan en `audit_logs`** (migraciones `20260620_pagos_*`):

- `admin_record_payment` · `admin_set_payment_date` · `admin_set_business_plan` (panel)
- `admin_set_account_status` · `admin_delete_user` (antes del borrado)
- `approve_plan_change_request` · `reject_plan_change_request`
- `admin_set_billing_config` · solicitudes `request_plan_change` (usuario)

## Checklist manual E2E (Roberto)

Marcar en localhost o prod tras deploy:

1. **Solicitud Premium** → admin aprueba → plan activo + vencimiento.
2. **Aviso / gracia** → banner `PaymentReminderBanner` visible en due_soon/grace (owner premium).
3. **Bloqueo** → `payment_state = blocked` → redirige a `/pago-atrasado` (`AccountGate`).
4. **Suspender titular** (admin) → owner + equipo ven cuenta suspendida; **reactivar** restaura.
5. **Suspender solo miembro** (pestaña Equipo) → solo ese usuario bloqueado.
6. **Registrar pago** admin → aparece en historial usuario (`PaymentHistory`) y en detalle negocio.
7. **Cambiar fecha de pago** admin → reflejado en negocio y banner.
8. **Rechazar solicitud** → audit en Logs (área Planes).
9. **Borrado** → solo negocio de prueba; previsualización + email exacto; sin filas huérfenas.
10. **Móvil 375px + desktop** en `/admin/planes` y `/cuenta/plan` (sin overflow).

## Riesgos a vigilar (plan §5)

- Sin red: el gate no debe bloquear por fallo de lectura de estado (revisar `SubscriptionContext` / `useAccountStatus` si cambian).
- Borrado irreversible: nunca en prod real sin cuenta de prueba.

## Cierre

Cuando el checklist manual esté marcado, **Pagos Premium F1–F8** se consideran cerrados en documentación.
Actualizar `PENDIENTES_POR_FASES.md` y `CLAUDE.md` § planes.
