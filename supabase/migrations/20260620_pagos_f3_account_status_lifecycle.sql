-- ============================================================================
-- PAGOS PREMIUM · FASE 3 — Bloqueo duro: account_status + ciclo de vida
-- (docs/PLAN_PAGOS_PREMIUM.md · Fase 3). Aplicado vía apply_migration.
--
--  1) account_status (suspensión/eliminación lógica por admin; la gestiona Fase 6)
--     + get_my_account_status() para el gate del cliente.
--  2) get_effective_plan_state: status 'suspended' -> payment_state 'blocked'
--     (defensivo; el resto se sigue calculando por fechas).
--  3) get_effective_plan_id: CONSCIENTE DE GRACIA — premium se mantiene en
--     ok/due_soon/grace y solo cae a 'free' cuando está bloqueado (pasada la
--     gracia) o suspendido. Lo usan los triggers de límites (monedas/socios).
--  4) advance_billing_lifecycle(): el cron ya NO baja premium->free en silencio;
--     ahora avanza active -> past_due (al vencer) -> suspended (pasada la gracia),
--     conservando plan_id='premium'. La conversión a free es decisión del owner
--     (downgrade) o del admin. Se reprograma el job diario de pg_cron.
--
-- Idempotente.
-- ============================================================================

-- 1) account_status ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.account_status (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','deleted')),
  reason text,
  updated_by uuid REFERENCES auth.users(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.account_status ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.account_status FROM anon;
GRANT SELECT ON public.account_status TO authenticated;

DROP POLICY IF EXISTS account_status_read ON public.account_status;
CREATE POLICY account_status_read ON public.account_status FOR SELECT TO authenticated
USING ((select auth.uid()) = user_id OR (select public.is_system_admin()));
-- Escritura solo vía RPC SECURITY DEFINER (admin, Fase 6): sin políticas de write.

CREATE OR REPLACE FUNCTION public.get_my_account_status()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
  SELECT COALESCE((SELECT status FROM public.account_status WHERE user_id = auth.uid()), 'active');
$$;

REVOKE EXECUTE ON FUNCTION public.get_my_account_status() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_my_account_status() TO authenticated;

-- 2) get_effective_plan_state: suspended -> blocked --------------------------
CREATE OR REPLACE FUNCTION public.get_effective_plan_state(target_business_id uuid)
RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp SET row_security = off
AS $$
DECLARE
  sub record;
  v_lead_days integer;
  v_grace_days integer;
  v_state text;
  v_grace_until timestamptz;
  v_days_until_due integer;
  v_now timestamptz := now();
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado' USING ERRCODE = 'P0001';
  END IF;

  IF NOT (auth.uid() = target_business_id OR public.is_member_of_team(target_business_id) OR public.is_system_admin()) THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE = 'P0001';
  END IF;

  SELECT bc.reminder_lead_days, bc.grace_days INTO v_lead_days, v_grace_days
  FROM public.billing_config bc WHERE bc.id = 1;
  v_lead_days := COALESCE(v_lead_days, 7);
  v_grace_days := COALESCE(v_grace_days, 3);

  SELECT * INTO sub FROM public.subscriptions WHERE user_id = target_business_id LIMIT 1;

  IF sub.user_id IS NULL OR sub.plan_id IS DISTINCT FROM 'premium' THEN
    RETURN json_build_object(
      'plan_id', COALESCE(sub.plan_id, 'free'),
      'status', COALESCE(sub.status, 'active'),
      'payment_state', 'free',
      'current_period_end', sub.current_period_end,
      'grace_until', NULL,
      'days_until_due', NULL,
      'billing_cycle', COALESCE(sub.billing_cycle, 'monthly'),
      'lead_days', v_lead_days,
      'grace_days', v_grace_days
    );
  END IF;

  IF sub.current_period_end IS NULL THEN
    v_state := 'ok';
    v_grace_until := NULL;
    v_days_until_due := NULL;
  ELSE
    v_grace_until := sub.current_period_end + make_interval(days => v_grace_days);
    v_days_until_due := CEIL(EXTRACT(EPOCH FROM (sub.current_period_end - v_now)) / 86400.0)::integer;
    IF v_now <= sub.current_period_end - make_interval(days => v_lead_days) THEN
      v_state := 'ok';
    ELSIF v_now <= sub.current_period_end THEN
      v_state := 'due_soon';
    ELSIF v_now <= v_grace_until THEN
      v_state := 'grace';
    ELSE
      v_state := 'blocked';
    END IF;
  END IF;

  -- Defensivo: una suscripción suspendida está bloqueada aunque las fechas digan otra cosa.
  IF sub.status = 'suspended' THEN
    v_state := 'blocked';
  END IF;

  RETURN json_build_object(
    'plan_id', 'premium',
    'status', sub.status,
    'payment_state', v_state,
    'current_period_end', sub.current_period_end,
    'grace_until', v_grace_until,
    'days_until_due', v_days_until_due,
    'billing_cycle', COALESCE(sub.billing_cycle, 'monthly'),
    'lead_days', v_lead_days,
    'grace_days', v_grace_days
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_effective_plan_state(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_effective_plan_state(uuid) FROM anon, public;

-- 3) get_effective_plan_id: consciente de gracia -----------------------------
CREATE OR REPLACE FUNCTION public.get_effective_plan_id(target_user uuid)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp SET row_security = off
AS $$
DECLARE
  v_plan text;
  v_status text;
  v_end timestamptz;
  v_grace integer;
BEGIN
  SELECT plan_id, status, current_period_end INTO v_plan, v_status, v_end
  FROM public.subscriptions WHERE user_id = target_user LIMIT 1;

  IF v_plan IS NULL THEN
    RETURN 'free';
  END IF;

  IF v_plan = 'premium' THEN
    IF v_status = 'suspended' THEN
      RETURN 'free';
    END IF;
    IF v_end IS NOT NULL THEN
      SELECT grace_days INTO v_grace FROM public.billing_config WHERE id = 1;
      v_grace := COALESCE(v_grace, 3);
      IF now() > v_end + make_interval(days => v_grace) THEN
        RETURN 'free';  -- bloqueado: pasada la gracia
      END IF;
    END IF;
    RETURN 'premium';  -- ok / due_soon / grace
  END IF;

  RETURN v_plan;
END;
$$;

REVOKE ALL ON FUNCTION public.get_effective_plan_id(uuid) FROM public, anon, authenticated;

-- 4) Ciclo de vida (cron): active -> past_due -> suspended (sin convertir a free)
CREATE OR REPLACE FUNCTION public.advance_billing_lifecycle()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
DECLARE
  v_grace_days integer;
  v_suspended integer := 0;
BEGIN
  SELECT grace_days INTO v_grace_days FROM public.billing_config WHERE id = 1;
  v_grace_days := COALESCE(v_grace_days, 3);

  -- Premium vencido y pasada la gracia -> suspended
  WITH s AS (
    UPDATE public.subscriptions
    SET status = 'suspended', updated_at = now()
    WHERE plan_id = 'premium'
      AND status IN ('active', 'past_due')
      AND current_period_end IS NOT NULL
      AND now() > current_period_end + make_interval(days => v_grace_days)
    RETURNING user_id, current_period_end
  )
  INSERT INTO public.audit_logs (business_id, actor_id, user_id, user_email, action, resource, details, area)
  SELECT s.user_id, NULL, s.user_id, 'system@cron', 'Suscripción Suspendida (cron)', 'Suscripción',
         jsonb_build_object('period_end', s.current_period_end, 'reason', 'impago tras periodo de gracia'), 'Planes'
  FROM s;
  GET DIAGNOSTICS v_suspended = ROW_COUNT;

  -- Premium recién vencido (dentro de la gracia) -> past_due
  WITH s2 AS (
    UPDATE public.subscriptions
    SET status = 'past_due', updated_at = now()
    WHERE plan_id = 'premium'
      AND status = 'active'
      AND current_period_end IS NOT NULL
      AND now() > current_period_end
      AND now() <= current_period_end + make_interval(days => v_grace_days)
    RETURNING user_id, current_period_end
  )
  INSERT INTO public.audit_logs (business_id, actor_id, user_id, user_email, action, resource, details, area)
  SELECT s2.user_id, NULL, s2.user_id, 'system@cron', 'Pago Vencido (cron)', 'Suscripción',
         jsonb_build_object('period_end', s2.current_period_end), 'Planes'
  FROM s2;

  RETURN v_suspended;
END;
$$;

REVOKE ALL ON FUNCTION public.advance_billing_lifecycle() FROM public, anon, authenticated;

-- Reprogramar el job diario (upsert por nombre en pg_cron) al nuevo ciclo de vida.
-- (Reemplaza la antigua expire_premium_subscriptions_auto que bajaba premium->free.)
SELECT cron.schedule('expire-premium-daily', '0 3 * * *', $$ select public.advance_billing_lifecycle(); $$);

NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- ROLLBACK (manual):
--   SELECT cron.schedule('expire-premium-daily','0 3 * * *', $$ select public.expire_premium_subscriptions_auto(); $$);
--   DROP FUNCTION IF EXISTS public.advance_billing_lifecycle();
--   DROP FUNCTION IF EXISTS public.get_my_account_status();
--   DROP TABLE IF EXISTS public.account_status;
--   (y restaurar get_effective_plan_id / get_effective_plan_state a su versión previa)
-- ============================================================================
