-- ============================================================================
-- AJUSTE PAGOS (2026-06-21) — El/los system_admin NUNCA vencen ni se bloquean.
-- La cuenta de superadmin también es una cuenta premium de ejemplo, pero gestiona
-- todo el sistema: su acceso no debe caducar. Se exime en:
--   - get_effective_plan_state (siempre premium/ok: sin banner, sin bloqueo, equipo ok)
--   - get_effective_plan_id (siempre premium: sin límites free en triggers)
--   - advance_billing_lifecycle (el cron no cambia su status)
-- y se limpia current_period_end a NULL (sin vencimiento) para todos los superadmins.
-- Aplicado vía apply_migration (pagos_adj_superadmin_never_expires).
-- Nota: cuerpos completos de las 3 funciones aplicados en la BD; el único cambio
-- respecto a la versión previa es la exención de system_admins (y, en el cron,
-- el AND NOT EXISTS (...system_admins...) en ambos UPDATE).
-- ============================================================================

-- get_effective_plan_state: superadmin -> premium/ok permanente (ver definición aplicada).
-- get_effective_plan_id:    superadmin -> 'premium' permanente.
-- advance_billing_lifecycle: excluye system_admins de past_due/suspended.

-- Limpieza de datos: superadmins sin vencimiento (solo current_period_end -> no
-- dispara trg_on_subscription_plan_changed).
UPDATE public.subscriptions
SET plan_id = 'premium', status = 'active', current_period_end = NULL, updated_at = now()
WHERE user_id IN (SELECT user_id FROM public.system_admins);

NOTIFY pgrst, 'reload schema';
