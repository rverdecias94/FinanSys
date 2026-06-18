-- P1.10 (Sesión 5, 2026-06-18) — APLICADO Y VERIFICADO en producción
-- (remotos: p1_10_enable_pg_cron, p1_10_premium_auto_expiry_function + cron.schedule vía SQL).
-- Premium vencido seguía activo: no había expiración automática y la habilitación premium keyeaba por
-- subscriptions.plan_id sin mirar current_period_end.
-- Parte cliente (SubscriptionContext.jsx): normalizeExpiredPremium() trata premium+active+vencido como
--   'free' al leer la suscripción → TODA la app (canAccessFeature/checkLimit/getPlanType/checks de
--   plan_id) honra el vencimiento sin esperar al cron. isPremium() también revisa current_period_end.
-- Parte BD (este archivo): job diario de pg_cron que persiste el cambio (premium vencido -> free/cancelled).
--   expire_past_due_subscriptions ya existía pero está gateada a is_system_admin() (no agendable en cron);
--   por eso se crea una gemela SIN gate, solo invocable por el owner/cron (REVOKE a public/anon/authenticated).
-- Verificado: invocando la función (lo que corre el cron) sobre un sujeto premium-vencido -> free/cancelled
--   + auditoría; el premium vigente (futuro) NO se toca. Localhost: con periodo vencido la UI oculta
--   pestañas premium (Equipo/Roles) y ofrece "Solicitar Premium". cron.job registrado y activo.
-- Rollback: select cron.unschedule('expire-premium-daily');
--           DROP FUNCTION public.expire_premium_subscriptions_auto();  (pg_cron puede quedarse instalado).

CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION public.expire_premium_subscriptions_auto()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
SET row_security TO 'off'
AS $$
DECLARE
  affected integer;
BEGIN
  WITH affected_rows AS (
    UPDATE public.subscriptions
    SET plan_id = 'free',
        status = 'cancelled',
        cancelled_at = now(),
        source = 'system',
        updated_at = now()
    WHERE plan_id = 'premium'
      AND current_period_end IS NOT NULL
      AND current_period_end < now()
    RETURNING user_id, current_period_end
  )
  INSERT INTO public.audit_logs (business_id, actor_id, user_id, user_email, action, resource, details, area)
  SELECT ar.user_id, NULL, ar.user_id, 'system@cron', 'Vencimiento Automático (cron)', 'Suscripción',
         jsonb_build_object('previous_period_end', ar.current_period_end), 'Planes'
  FROM affected_rows ar;

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

REVOKE ALL ON FUNCTION public.expire_premium_subscriptions_auto() FROM public, anon, authenticated;

-- Job diario a las 03:00 UTC (cron.schedule hace upsert por nombre en pg_cron 1.6+)
SELECT cron.schedule('expire-premium-daily', '0 3 * * *', $$ select public.expire_premium_subscriptions_auto(); $$);
