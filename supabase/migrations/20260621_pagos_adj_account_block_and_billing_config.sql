-- ============================================================================
-- AJUSTE PAGOS (2026-06-21) — (1) Cuenta de dueño inhabilitada (account_status)
-- bloquea a TODO el negocio (dueño + equipo) vía get_effective_plan_state.
-- (2) Config de aviso/gracia editable por admin desde el FE. (3) Quitar
-- admin_list_team_members (la gestión de equipo la hacen las cuentas premium).
-- Aplicado vía apply_migration (pagos_adj_account_block_and_billing_config).
-- ============================================================================

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

  -- Cuenta del DUEÑO inhabilitada por el admin (suspendida/eliminada): TODO el
  -- negocio (dueño + equipo) queda bloqueado, sea cual sea el plan o las fechas.
  IF EXISTS (SELECT 1 FROM public.account_status acc
             WHERE acc.user_id = target_business_id AND acc.status IN ('suspended','deleted')) THEN
    RETURN json_build_object(
      'plan_id', COALESCE(sub.plan_id, 'free'), 'status', COALESCE(sub.status, 'active'),
      'payment_state', 'blocked', 'current_period_end', sub.current_period_end,
      'grace_until', NULL, 'days_until_due', NULL,
      'billing_cycle', COALESCE(sub.billing_cycle, 'monthly'),
      'lead_days', v_lead_days, 'grace_days', v_grace_days);
  END IF;

  IF sub.user_id IS NULL OR sub.plan_id IS DISTINCT FROM 'premium' THEN
    RETURN json_build_object(
      'plan_id', COALESCE(sub.plan_id, 'free'), 'status', COALESCE(sub.status, 'active'),
      'payment_state', 'free', 'current_period_end', sub.current_period_end,
      'grace_until', NULL, 'days_until_due', NULL,
      'billing_cycle', COALESCE(sub.billing_cycle, 'monthly'),
      'lead_days', v_lead_days, 'grace_days', v_grace_days);
  END IF;

  IF sub.current_period_end IS NULL THEN
    v_state := 'ok'; v_grace_until := NULL; v_days_until_due := NULL;
  ELSE
    v_grace_until := sub.current_period_end + make_interval(days => v_grace_days);
    v_days_until_due := CEIL(EXTRACT(EPOCH FROM (sub.current_period_end - v_now)) / 86400.0)::integer;
    IF v_now <= sub.current_period_end - make_interval(days => v_lead_days) THEN v_state := 'ok';
    ELSIF v_now <= sub.current_period_end THEN v_state := 'due_soon';
    ELSIF v_now <= v_grace_until THEN v_state := 'grace';
    ELSE v_state := 'blocked';
    END IF;
  END IF;

  IF sub.status = 'suspended' THEN v_state := 'blocked'; END IF;

  RETURN json_build_object(
    'plan_id', 'premium', 'status', sub.status, 'payment_state', v_state,
    'current_period_end', sub.current_period_end, 'grace_until', v_grace_until,
    'days_until_due', v_days_until_due, 'billing_cycle', COALESCE(sub.billing_cycle, 'monthly'),
    'lead_days', v_lead_days, 'grace_days', v_grace_days);
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_effective_plan_state(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_effective_plan_state(uuid) FROM anon, public;

CREATE OR REPLACE FUNCTION public.admin_get_billing_config()
RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp SET row_security = off
AS $$
DECLARE v json;
BEGIN
  IF NOT public.is_system_admin() THEN
    RAISE EXCEPTION 'Solo un administrador del sistema' USING ERRCODE = 'P0001';
  END IF;
  SELECT json_build_object('reminder_lead_days', reminder_lead_days, 'grace_days', grace_days, 'updated_at', updated_at)
  INTO v FROM public.billing_config WHERE id = 1;
  RETURN COALESCE(v, json_build_object('reminder_lead_days', 7, 'grace_days', 3));
END;
$$;
REVOKE ALL ON FUNCTION public.admin_get_billing_config() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_billing_config() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_billing_config(p_reminder_lead_days integer, p_grace_days integer)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp SET row_security = off
AS $$
DECLARE admin_email text;
BEGIN
  IF NOT public.is_system_admin() THEN
    RAISE EXCEPTION 'Solo un administrador del sistema' USING ERRCODE = 'P0001';
  END IF;
  IF p_reminder_lead_days IS NULL OR p_reminder_lead_days < 0 OR p_reminder_lead_days > 90 THEN
    RAISE EXCEPTION 'Días de aviso fuera de rango (0-90)' USING ERRCODE = 'P0001';
  END IF;
  IF p_grace_days IS NULL OR p_grace_days < 0 OR p_grace_days > 90 THEN
    RAISE EXCEPTION 'Días de gracia fuera de rango (0-90)' USING ERRCODE = 'P0001';
  END IF;
  admin_email := public.get_current_user_email();
  INSERT INTO public.billing_config (id, reminder_lead_days, grace_days, updated_at)
  VALUES (1, p_reminder_lead_days, p_grace_days, now())
  ON CONFLICT (id) DO UPDATE
    SET reminder_lead_days = excluded.reminder_lead_days, grace_days = excluded.grace_days, updated_at = now();
  INSERT INTO public.audit_logs (business_id, actor_id, user_id, user_email, action, resource, details, area)
  VALUES (auth.uid(), auth.uid(), auth.uid(), admin_email, 'Configurar Facturación', 'Días de aviso/gracia',
    jsonb_build_object('reminder_lead_days', p_reminder_lead_days, 'grace_days', p_grace_days), 'Planes');
  RETURN json_build_object('reminder_lead_days', p_reminder_lead_days, 'grace_days', p_grace_days);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_set_billing_config(integer, integer) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_billing_config(integer, integer) TO authenticated;

DROP FUNCTION IF EXISTS public.admin_list_team_members(uuid, text, text, integer, integer);

NOTIFY pgrst, 'reload schema';
