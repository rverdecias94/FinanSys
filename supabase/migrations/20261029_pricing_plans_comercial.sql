-- ============================================================================
-- Planes comerciales: Inicial / Negocio / Élite
-- - Nombres display + límites + pricing (anual -20%)
-- - contact_name en solicitudes
-- - consume_ai_quota: premium|ultra según cupos del plan
-- Idempotente.
-- ============================================================================

-- 1) Catálogo: nombres, límites, precios --------------------------------------
UPDATE public.plans
SET
  name = 'Plan Inicial',
  price_monthly = 0,
  features = jsonb_build_object(
    'reports_export', false,
    'audit_logs', false,
    'custom_branding', false,
    'watermark', true,
    'ai_tools', false
  ),
  limits = jsonb_build_object(
    'monthly_transactions', 40,
    'products', 30,
    'areas', 1,
    'partners', 0,
    'currencies', 1,
    'ai_doc_pages', 0,
    'ai_calc_queries', 0
  ),
  pricing = jsonb_build_object(
    'monthly', 0,
    'annual', 0,
    'annual_discount_pct', 20,
    'currency', 'USD'
  )
WHERE id = 'free';

UPDATE public.plans
SET
  name = 'Plan Negocio',
  price_monthly = 10,
  features = jsonb_build_object(
    'reports_export', true,
    'audit_logs', true,
    'custom_branding', true,
    'watermark', false,
    'ai_tools', true
  ),
  limits = jsonb_build_object(
    'monthly_transactions', 300,
    'products', 150,
    'areas', 3,
    'partners', 2,
    'currencies', 2,
    'ai_doc_pages', 20,
    'ai_calc_queries', 5
  ),
  pricing = jsonb_build_object(
    'monthly', 10,
    'annual', 96,
    'annual_discount_pct', 20,
    'currency', 'USD'
  )
WHERE id = 'premium';

UPDATE public.plans
SET
  name = 'Plan Élite',
  price_monthly = 20,
  features = jsonb_build_object(
    'reports_export', true,
    'audit_logs', true,
    'custom_branding', true,
    'watermark', false,
    'ai_tools', true
  ),
  limits = jsonb_build_object(
    'monthly_transactions', -1,
    'products', -1,
    'areas', -1,
    'partners', 10,
    'currencies', -1,
    'ai_doc_pages', 100,
    'ai_calc_queries', 50
  ),
  pricing = jsonb_build_object(
    'monthly', 20,
    'annual', 192,
    'annual_discount_pct', 20,
    'currency', 'USD'
  )
WHERE id = 'ultra';

-- 2) Nombre del cliente en solicitudes ---------------------------------------
ALTER TABLE public.plan_change_requests
  ADD COLUMN IF NOT EXISTS contact_name text;

-- 3) Solicitud de plan: contact_name + ciclos mensual/anual -------------------
DROP FUNCTION IF EXISTS public.request_plan_change(text, integer, text, text, text, text, text);
DROP FUNCTION IF EXISTS public.request_plan_change(text, integer, text, text, text, text, text, text);

CREATE OR REPLACE FUNCTION public.request_plan_change(
  target_plan_id text,
  requested_months integer DEFAULT 1,
  contact_phone text DEFAULT NULL,
  payment_method text DEFAULT NULL,
  payment_reference text DEFAULT NULL,
  user_notes text DEFAULT NULL,
  billing_cycle text DEFAULT NULL,
  contact_name text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
DECLARE
  v_business_id uuid;
  current_plan text;
  request_id uuid;
  current_email text;
  v_cycle text;
  v_months integer;
  v_amount numeric;
  v_name text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado' USING ERRCODE = 'P0001';
  END IF;

  v_business_id := public.get_current_business_id();
  IF v_business_id IS NULL OR v_business_id <> auth.uid() THEN
    RAISE EXCEPTION 'Solo el propietario puede solicitar cambios de plan' USING ERRCODE = 'P0001';
  END IF;

  IF target_plan_id IS NULL OR NOT public.is_paid_plan_id(target_plan_id) THEN
    RAISE EXCEPTION 'Solo se permiten solicitudes manuales para Negocio o Élite' USING ERRCODE = 'P0001';
  END IF;

  v_name := NULLIF(trim(contact_name), '');
  IF v_name IS NULL THEN
    RAISE EXCEPTION 'El nombre del cliente es obligatorio' USING ERRCODE = 'P0001';
  END IF;

  IF NULLIF(trim(contact_phone), '') IS NULL THEN
    RAISE EXCEPTION 'El teléfono de contacto es obligatorio' USING ERRCODE = 'P0001';
  END IF;

  IF NULLIF(trim(payment_method), '') IS NULL THEN
    RAISE EXCEPTION 'La forma de pago es obligatoria' USING ERRCODE = 'P0001';
  END IF;

  v_cycle := NULLIF(trim(billing_cycle), '');
  IF v_cycle IS NOT NULL AND v_cycle NOT IN ('monthly', 'annual') THEN
    RAISE EXCEPTION 'Ciclo de facturación inválido (usa mensual o anual)' USING ERRCODE = 'P0001';
  END IF;
  IF v_cycle IS NULL THEN
    IF requested_months IS NULL OR requested_months < 1 THEN requested_months := 1; END IF;
    v_cycle := CASE
      WHEN requested_months >= 12 THEN 'annual'
      ELSE 'monthly'
    END;
  END IF;
  v_months := public.billing_cycle_months(v_cycle);
  v_amount := public.plan_price_for_cycle(target_plan_id, v_cycle);

  SELECT COALESCE(s.plan_id, 'free') INTO current_plan
  FROM public.subscriptions s
  WHERE s.user_id = v_business_id
  LIMIT 1;
  current_plan := COALESCE(current_plan, 'free');

  IF current_plan = target_plan_id THEN
    RAISE EXCEPTION 'El negocio ya tiene ese plan activo' USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.plan_change_requests pcr
    WHERE pcr.business_id = v_business_id AND pcr.status = 'pending'
  ) THEN
    RAISE EXCEPTION 'Ya existe una solicitud pendiente para este negocio' USING ERRCODE = 'P0001';
  END IF;

  current_email := public.get_current_user_email();

  INSERT INTO public.plan_change_requests (
    business_id, requested_by, requested_plan_id, current_plan_id,
    requested_months, billing_cycle, requested_amount,
    contact_name, contact_phone, contact_email, payment_method, payment_reference, user_notes
  )
  VALUES (
    v_business_id, auth.uid(), target_plan_id, current_plan,
    v_months, v_cycle, v_amount,
    v_name, NULLIF(trim(contact_phone), ''), NULLIF(current_email, ''),
    NULLIF(trim(payment_method), ''), NULLIF(trim(payment_reference), ''), NULLIF(trim(user_notes), '')
  )
  RETURNING id INTO request_id;

  INSERT INTO public.audit_logs (business_id, actor_id, user_id, user_email, action, resource, details, area)
  VALUES (
    v_business_id, auth.uid(), auth.uid(), current_email, 'Solicitar Plan',
    CASE WHEN target_plan_id = 'ultra' THEN 'Plan Élite' ELSE 'Plan Negocio' END,
    jsonb_build_object(
      'request_id', request_id, 'current_plan', current_plan, 'requested_plan', target_plan_id,
      'billing_cycle', v_cycle, 'requested_months', v_months, 'requested_amount', v_amount,
      'contact_name', v_name
    ),
    'Planes'
  );

  RETURN json_build_object(
    'request_id', request_id, 'status', 'pending',
    'billing_cycle', v_cycle, 'amount', v_amount, 'plan_id', target_plan_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_plan_change(text, integer, text, text, text, text, text, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.request_plan_change(text, integer, text, text, text, text, text, text) FROM anon, public;

-- 4) Cupos IA: cualquier plan con ai_tools + límites del plan -----------------
CREATE OR REPLACE FUNCTION public.consume_ai_quota(
  p_kind text,
  p_units integer DEFAULT 1,
  p_business_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
DECLARE
  v_business uuid;
  v_period date;
  v_plan text;
  v_limit integer;
  v_used integer;
  v_new integer;
  v_ai boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado' USING ERRCODE = 'P0001';
  END IF;

  IF p_kind IS NULL OR p_kind NOT IN ('doc_pages', 'calc_queries') THEN
    RAISE EXCEPTION 'Tipo de cupo inválido' USING ERRCODE = 'P0001';
  END IF;
  IF p_units IS NULL OR p_units < 1 THEN
    RAISE EXCEPTION 'Unidades inválidas' USING ERRCODE = 'P0001';
  END IF;

  v_business := COALESCE(p_business_id, public.get_current_business_id());
  IF v_business IS NULL THEN
    RAISE EXCEPTION 'Negocio no resuelto' USING ERRCODE = 'P0001';
  END IF;
  IF NOT (auth.uid() = v_business OR public.is_member_of_team(v_business)) THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE = 'P0001';
  END IF;

  v_plan := public.get_effective_plan_id(v_business);

  SELECT COALESCE((features ->> 'ai_tools')::boolean, false)
  INTO v_ai
  FROM public.plans
  WHERE id = v_plan;

  IF NOT COALESCE(v_ai, false) THEN
    RAISE EXCEPTION 'Las herramientas de IA requieren un plan con Copiloto' USING ERRCODE = 'P0001';
  END IF;

  v_period := date_trunc('month', now())::date;

  IF p_kind = 'doc_pages' THEN
    SELECT COALESCE((limits ->> 'ai_doc_pages')::integer, 0) INTO v_limit FROM public.plans WHERE id = v_plan;
  ELSE
    SELECT COALESCE((limits ->> 'ai_calc_queries')::integer, 0) INTO v_limit FROM public.plans WHERE id = v_plan;
  END IF;

  IF v_limit IS NULL OR v_limit <= 0 THEN
    RAISE EXCEPTION 'Este plan no incluye cupo para esa herramienta' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.ai_usage (business_id, period_start, doc_pages_used, calc_queries_used, updated_at)
  VALUES (v_business, v_period, 0, 0, now())
  ON CONFLICT (business_id, period_start) DO NOTHING;

  IF p_kind = 'doc_pages' THEN
    SELECT doc_pages_used INTO v_used FROM public.ai_usage
    WHERE business_id = v_business AND period_start = v_period FOR UPDATE;
    IF v_used + p_units > v_limit THEN
      RAISE EXCEPTION 'Cupo mensual de páginas agotado (% / %)', v_used, v_limit USING ERRCODE = 'P0001';
    END IF;
    UPDATE public.ai_usage
    SET doc_pages_used = doc_pages_used + p_units, updated_at = now()
    WHERE business_id = v_business AND period_start = v_period
    RETURNING doc_pages_used INTO v_new;
  ELSE
    SELECT calc_queries_used INTO v_used FROM public.ai_usage
    WHERE business_id = v_business AND period_start = v_period FOR UPDATE;
    IF v_used + p_units > v_limit THEN
      RAISE EXCEPTION 'Cupo mensual de consultas agotado (% / %)', v_used, v_limit USING ERRCODE = 'P0001';
    END IF;
    UPDATE public.ai_usage
    SET calc_queries_used = calc_queries_used + p_units, updated_at = now()
    WHERE business_id = v_business AND period_start = v_period
    RETURNING calc_queries_used INTO v_new;
  END IF;

  RETURN json_build_object(
    'kind', p_kind,
    'units', p_units,
    'used', v_new,
    'limit', v_limit,
    'period_start', v_period
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.consume_ai_quota(text, integer, uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.consume_ai_quota(text, integer, uuid) FROM anon, public;

NOTIFY pgrst, 'reload schema';
