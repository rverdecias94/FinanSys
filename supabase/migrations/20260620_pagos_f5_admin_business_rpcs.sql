-- ============================================================================
-- PAGOS PREMIUM · FASE 5 — Admin: negocios + fecha de pago + registrar pago
-- (docs/PLAN_PAGOS_PREMIUM.md · Fase 5). Aplicado vía apply_migration.
--
--  1) get_payment_state(plan, status, period_end): helper reutilizable (misma
--     semántica que get_effective_plan_state) para calcular estado por fila.
--  2) admin_list_businesses(filtros): lista de DUEÑOS (negocios) con email, plan,
--     estado de pago, ciclo, vencimiento, nº de miembros y último pago. Paginado.
--  3) admin_get_business_detail(business_id): suscripción + pagos + miembros +
--     solicitudes recientes.
--  4) admin_set_payment_date(business_id, new_period_end): ajusta el vencimiento
--     (y reactiva si la nueva fecha es futura) + auditoría.
--
-- Todas SECURITY DEFINER gated is_system_admin(); EXECUTE solo authenticated.
-- ============================================================================

-- 1) Helper de estado de pago ------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_payment_state(p_plan text, p_status text, p_end timestamptz)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
DECLARE
  v_lead integer;
  v_grace integer;
  v_now timestamptz := now();
BEGIN
  IF p_plan IS DISTINCT FROM 'premium' THEN
    RETURN 'free';
  END IF;
  IF p_status = 'suspended' THEN
    RETURN 'blocked';
  END IF;
  IF p_end IS NULL THEN
    RETURN 'ok';
  END IF;
  SELECT reminder_lead_days, grace_days INTO v_lead, v_grace FROM public.billing_config WHERE id = 1;
  v_lead := COALESCE(v_lead, 7);
  v_grace := COALESCE(v_grace, 3);
  IF v_now <= p_end - make_interval(days => v_lead) THEN RETURN 'ok';
  ELSIF v_now <= p_end THEN RETURN 'due_soon';
  ELSIF v_now <= p_end + make_interval(days => v_grace) THEN RETURN 'grace';
  ELSE RETURN 'blocked';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.get_payment_state(text, text, timestamptz) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_payment_state(text, text, timestamptz) TO authenticated;

-- 2) Listado de negocios -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_list_businesses(
  p_search text DEFAULT NULL,
  p_plan text DEFAULT NULL,
  p_payment_state text DEFAULT NULL,
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 10
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
DECLARE
  v_from integer;
  v_size integer;
  v_result json;
BEGIN
  IF NOT public.is_system_admin() THEN
    RAISE EXCEPTION 'Solo un administrador del sistema' USING ERRCODE = 'P0001';
  END IF;
  v_size := COALESCE(p_page_size, 10);
  v_from := GREATEST(0, (COALESCE(p_page, 1) - 1) * v_size);

  WITH base AS (
    SELECT s.user_id AS business_id, u.email AS email, s.plan_id, s.status, s.billing_cycle,
           s.current_period_end,
           public.get_payment_state(s.plan_id, s.status, s.current_period_end) AS payment_state,
           (SELECT count(*) FROM public.team_members tm WHERE tm.owner_id = s.user_id AND tm.status = 'active') AS members,
           (SELECT row_to_json(p) FROM (
              SELECT amount, paid_at, billing_cycle FROM public.payments pp
              WHERE pp.business_id = s.user_id ORDER BY paid_at DESC LIMIT 1) p) AS last_payment,
           s.created_at
    FROM public.subscriptions s
    LEFT JOIN auth.users u ON u.id = s.user_id
    WHERE NOT EXISTS (SELECT 1 FROM public.team_members m WHERE m.member_id = s.user_id AND m.status = 'active')
  ),
  filtered AS (
    SELECT * FROM base
    WHERE (p_search IS NULL OR p_search = '' OR email ILIKE '%' || p_search || '%' OR business_id::text ILIKE '%' || p_search || '%')
      AND (p_plan IS NULL OR p_plan = 'all' OR plan_id = p_plan)
      AND (p_payment_state IS NULL OR p_payment_state = 'all' OR payment_state = p_payment_state)
  )
  SELECT json_build_object(
    'rows', COALESCE((SELECT json_agg(pg) FROM (SELECT * FROM filtered ORDER BY created_at DESC OFFSET v_from LIMIT v_size) pg), '[]'::json),
    'total', (SELECT count(*) FROM filtered)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_businesses(text, text, text, integer, integer) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_businesses(text, text, text, integer, integer) TO authenticated;

-- 3) Detalle de un negocio ---------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_get_business_detail(p_business_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
BEGIN
  IF NOT public.is_system_admin() THEN
    RAISE EXCEPTION 'Solo un administrador del sistema' USING ERRCODE = 'P0001';
  END IF;
  IF p_business_id IS NULL THEN
    RAISE EXCEPTION 'business_id requerido' USING ERRCODE = 'P0001';
  END IF;

  RETURN json_build_object(
    'business_id', p_business_id,
    'email', (SELECT email FROM auth.users WHERE id = p_business_id),
    'subscription', (SELECT row_to_json(s) FROM (
        SELECT plan_id, status, billing_cycle, current_period_start, current_period_end,
               source, approved_at, cancelled_at, admin_notes
        FROM public.subscriptions WHERE user_id = p_business_id) s),
    'payment_state', (SELECT public.get_payment_state(plan_id, status, current_period_end)
                      FROM public.subscriptions WHERE user_id = p_business_id),
    'payments', (SELECT COALESCE(json_agg(p), '[]'::json) FROM (
        SELECT id, amount, currency_code, billing_cycle, period_start, period_end, paid_at,
               method, reference, status, notes
        FROM public.payments WHERE business_id = p_business_id ORDER BY paid_at DESC) p),
    'members', (SELECT COALESCE(json_agg(m), '[]'::json) FROM (
        SELECT tm.member_email, tm.member_id, tm.status, r.name AS role
        FROM public.team_members tm LEFT JOIN public.roles r ON r.id = tm.role_id
        WHERE tm.owner_id = p_business_id ORDER BY tm.created_at ASC) m),
    'requests', (SELECT COALESCE(json_agg(q), '[]'::json) FROM (
        SELECT id, requested_plan_id, billing_cycle, requested_amount, status, created_at
        FROM public.plan_change_requests WHERE business_id = p_business_id
        ORDER BY created_at DESC LIMIT 10) q)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_business_detail(uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_business_detail(uuid) TO authenticated;

-- 4) Cambiar fecha de pago ---------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_set_payment_date(p_business_id uuid, p_new_period_end timestamptz)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
DECLARE
  admin_email text;
  v_plan text;
BEGIN
  IF NOT public.is_system_admin() THEN
    RAISE EXCEPTION 'Solo un administrador del sistema' USING ERRCODE = 'P0001';
  END IF;
  IF p_business_id IS NULL OR p_new_period_end IS NULL THEN
    RAISE EXCEPTION 'Parámetros requeridos' USING ERRCODE = 'P0001';
  END IF;

  SELECT plan_id INTO v_plan FROM public.subscriptions WHERE user_id = p_business_id;
  IF v_plan IS NULL THEN
    RAISE EXCEPTION 'Negocio sin suscripción' USING ERRCODE = 'P0001';
  END IF;

  admin_email := public.get_current_user_email();

  UPDATE public.subscriptions
  SET current_period_end = p_new_period_end,
      status = CASE WHEN plan_id = 'premium' AND p_new_period_end > now() THEN 'active' ELSE status END,
      updated_at = now()
  WHERE user_id = p_business_id;

  INSERT INTO public.audit_logs (business_id, actor_id, user_id, user_email, action, resource, details, area)
  VALUES (p_business_id, auth.uid(), auth.uid(), admin_email, 'Cambiar Fecha de Pago', 'Suscripción',
          jsonb_build_object('current_period_end', p_new_period_end), 'Planes');

  RETURN json_build_object('business_id', p_business_id, 'current_period_end', p_new_period_end);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_payment_date(uuid, timestamptz) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_payment_date(uuid, timestamptz) TO authenticated;

NOTIFY pgrst, 'reload schema';
