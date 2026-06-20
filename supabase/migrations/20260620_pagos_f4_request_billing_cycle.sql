-- ============================================================================
-- PAGOS PREMIUM · FASE 4 — Ciclos de pago + 15% en la SOLICITUD de Premium
-- (docs/PLAN_PAGOS_PREMIUM.md · Fase 4). Aplicado vía apply_migration.
--
--  1) plan_change_requests.billing_cycle + requested_amount
--  2) request_plan_change: acepta billing_cycle, deriva meses (1/3/12) e importe
--     desde plans.pricing (DROP+CREATE para evitar overloads; el nuevo parámetro
--     es opcional → las llamadas de 6 args siguen funcionando).
--  3) approve_plan_change_request: por defecto usa el ciclo solicitado en la
--     solicitud (req.billing_cycle) si el admin no especifica otro.
--
-- Idempotente.
-- ============================================================================

-- 1) Columnas de ciclo/importe en solicitudes --------------------------------
ALTER TABLE public.plan_change_requests
  ADD COLUMN IF NOT EXISTS billing_cycle text NOT NULL DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS requested_amount numeric(12,2);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'plan_change_requests_billing_cycle_check') THEN
    ALTER TABLE public.plan_change_requests
      ADD CONSTRAINT plan_change_requests_billing_cycle_check
      CHECK (billing_cycle IN ('monthly','quarterly','annual'));
  END IF;
END $$;

-- 2) request_plan_change con ciclo (DROP+CREATE) -----------------------------
DROP FUNCTION IF EXISTS public.request_plan_change(text, integer, text, text, text, text);

CREATE OR REPLACE FUNCTION public.request_plan_change(
  target_plan_id text,
  requested_months integer DEFAULT 1,
  contact_phone text DEFAULT NULL,
  payment_method text DEFAULT NULL,
  payment_reference text DEFAULT NULL,
  user_notes text DEFAULT NULL,
  billing_cycle text DEFAULT NULL
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
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado' USING ERRCODE = 'P0001';
  END IF;

  v_business_id := public.get_current_business_id();
  IF v_business_id IS NULL OR v_business_id <> auth.uid() THEN
    RAISE EXCEPTION 'Solo el propietario puede solicitar cambios de plan' USING ERRCODE = 'P0001';
  END IF;

  IF target_plan_id IS NULL OR target_plan_id NOT IN ('premium') THEN
    RAISE EXCEPTION 'Solo se permiten solicitudes manuales para Premium' USING ERRCODE = 'P0001';
  END IF;

  -- Resolver ciclo: el explícito manda; si no, se infiere de los meses.
  v_cycle := NULLIF(trim(billing_cycle), '');
  IF v_cycle IS NOT NULL AND v_cycle NOT IN ('monthly','quarterly','annual') THEN
    RAISE EXCEPTION 'Ciclo de facturación inválido' USING ERRCODE = 'P0001';
  END IF;
  IF v_cycle IS NULL THEN
    IF requested_months IS NULL OR requested_months < 1 THEN requested_months := 1; END IF;
    v_cycle := CASE requested_months WHEN 12 THEN 'annual' WHEN 3 THEN 'quarterly' WHEN 1 THEN 'monthly' ELSE 'monthly' END;
  END IF;
  v_months := public.billing_cycle_months(v_cycle);
  v_amount := public.premium_price_for_cycle(v_cycle);

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
    contact_phone, contact_email, payment_method, payment_reference, user_notes
  )
  VALUES (
    v_business_id, auth.uid(), target_plan_id, current_plan,
    v_months, v_cycle, v_amount,
    NULLIF(trim(contact_phone), ''), NULLIF(current_email, ''),
    NULLIF(trim(payment_method), ''), NULLIF(trim(payment_reference), ''), NULLIF(trim(user_notes), '')
  )
  RETURNING id INTO request_id;

  INSERT INTO public.audit_logs (business_id, actor_id, user_id, user_email, action, resource, details, area)
  VALUES (
    v_business_id, auth.uid(), auth.uid(), current_email, 'Solicitar Plan', 'Plan Premium',
    jsonb_build_object('request_id', request_id, 'current_plan', current_plan, 'requested_plan', target_plan_id,
                       'billing_cycle', v_cycle, 'requested_months', v_months, 'requested_amount', v_amount),
    'Planes'
  );

  RETURN json_build_object('request_id', request_id, 'status', 'pending', 'billing_cycle', v_cycle, 'amount', v_amount);
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_plan_change(text, integer, text, text, text, text, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.request_plan_change(text, integer, text, text, text, text, text) FROM anon, public;

-- 3) approve_plan_change_request: por defecto usa el ciclo de la solicitud -----
CREATE OR REPLACE FUNCTION public.approve_plan_change_request(
  request_id uuid,
  approved_months integer DEFAULT NULL,
  admin_notes text DEFAULT NULL,
  billing_cycle text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
DECLARE
  req record;
  months integer;
  v_cycle text;
  v_amount numeric;
  v_payment_id bigint;
  period_start timestamptz;
  period_end timestamptz;
  admin_email text;
  v_admin_notes text;
BEGIN
  IF NOT public.is_system_admin() THEN
    RAISE EXCEPTION 'Solo un administrador del sistema puede aprobar solicitudes' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO req FROM public.plan_change_requests WHERE id = request_id FOR UPDATE;
  IF req.id IS NULL THEN RAISE EXCEPTION 'Solicitud no encontrada' USING ERRCODE = 'P0001'; END IF;
  IF req.status <> 'pending' THEN RAISE EXCEPTION 'La solicitud ya fue procesada' USING ERRCODE = 'P0001'; END IF;

  -- Ciclo: el del admin manda; si no, el solicitado; si no, inferido de meses.
  v_cycle := NULLIF(trim(billing_cycle), '');
  IF v_cycle IS NULL THEN v_cycle := req.billing_cycle; END IF;
  IF v_cycle IS NOT NULL AND v_cycle NOT IN ('monthly','quarterly','annual') THEN
    RAISE EXCEPTION 'Ciclo de facturación inválido' USING ERRCODE = 'P0001';
  END IF;

  IF v_cycle IS NOT NULL THEN
    months := public.billing_cycle_months(v_cycle);
  ELSE
    months := COALESCE(approved_months, req.requested_months, 1);
    IF months < 1 THEN months := 1; END IF;
    v_cycle := CASE months WHEN 12 THEN 'annual' WHEN 3 THEN 'quarterly' WHEN 1 THEN 'monthly' ELSE 'monthly' END;
  END IF;

  v_admin_notes := NULLIF(trim(admin_notes), '');
  period_start := now();
  period_end := period_start + make_interval(months => months);
  admin_email := public.get_current_user_email();

  INSERT INTO public.subscriptions (
    user_id, plan_id, status, billing_cycle, current_period_start, current_period_end,
    source, approved_by, approved_at, admin_notes, created_at, updated_at
  )
  VALUES (
    req.business_id, req.requested_plan_id, 'active', v_cycle, period_start, period_end,
    'manual', auth.uid(), now(), v_admin_notes, now(), now()
  )
  ON CONFLICT (user_id) DO UPDATE
  SET plan_id = excluded.plan_id, status = excluded.status, billing_cycle = excluded.billing_cycle,
      current_period_start = excluded.current_period_start, current_period_end = excluded.current_period_end,
      source = excluded.source, approved_by = excluded.approved_by, approved_at = excluded.approved_at,
      admin_notes = excluded.admin_notes, trial_start_at = NULL, trial_end_at = NULL,
      cancelled_by = NULL, cancelled_at = NULL, updated_at = now();

  UPDATE public.plan_change_requests
  SET status = 'approved', reviewed_by = auth.uid(), reviewed_at = now(), admin_notes = v_admin_notes, updated_at = now()
  WHERE id = req.id;

  IF req.requested_plan_id = 'premium' THEN
    v_amount := public.premium_price_for_cycle(v_cycle);
    INSERT INTO public.payments (business_id, amount, currency_code, billing_cycle, period_start, period_end,
                                 paid_at, method, reference, status, request_id, recorded_by, notes)
    VALUES (req.business_id, COALESCE(v_amount, 0), 'USD', v_cycle, period_start, period_end,
            now(), req.payment_method, req.payment_reference, 'paid', req.id, auth.uid(), v_admin_notes)
    RETURNING id INTO v_payment_id;
  END IF;

  INSERT INTO public.audit_logs (business_id, actor_id, user_id, user_email, action, resource, details, area)
  VALUES (req.business_id, auth.uid(), auth.uid(), admin_email, 'Aprobar Plan', 'Plan Premium',
    jsonb_build_object('request_id', req.id, 'approved_plan', req.requested_plan_id, 'approved_months', months,
                       'billing_cycle', v_cycle, 'period_end', period_end, 'payment_id', v_payment_id),
    'Planes');

  RETURN json_build_object('request_id', req.id, 'business_id', req.business_id, 'plan_id', req.requested_plan_id,
                           'status', 'approved', 'current_period_end', period_end, 'billing_cycle', v_cycle,
                           'payment_id', v_payment_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_plan_change_request(uuid, integer, text, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.approve_plan_change_request(uuid, integer, text, text) FROM anon, public;

NOTIFY pgrst, 'reload schema';
