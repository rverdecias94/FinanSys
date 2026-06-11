-- Fix PL/pgSQL ambiguity between variable and column name `business_id`.

CREATE OR REPLACE FUNCTION public.request_plan_change(
  target_plan_id text,
  requested_months integer DEFAULT 1,
  contact_phone text DEFAULT NULL,
  payment_method text DEFAULT NULL,
  payment_reference text DEFAULT NULL,
  user_notes text DEFAULT NULL
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

  IF requested_months IS NULL OR requested_months < 1 THEN
    requested_months := 1;
  END IF;

  SELECT COALESCE(s.plan_id, 'free') INTO current_plan
  FROM public.subscriptions s
  WHERE s.user_id = v_business_id
  LIMIT 1;
  current_plan := COALESCE(current_plan, 'free');

  IF current_plan = target_plan_id THEN
    RAISE EXCEPTION 'El negocio ya tiene ese plan activo' USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.plan_change_requests pcr
    WHERE pcr.business_id = v_business_id
      AND pcr.status = 'pending'
  ) THEN
    RAISE EXCEPTION 'Ya existe una solicitud pendiente para este negocio' USING ERRCODE = 'P0001';
  END IF;

  current_email := public.get_current_user_email();

  INSERT INTO public.plan_change_requests (
    business_id,
    requested_by,
    requested_plan_id,
    current_plan_id,
    requested_months,
    contact_phone,
    contact_email,
    payment_method,
    payment_reference,
    user_notes
  )
  VALUES (
    v_business_id,
    auth.uid(),
    target_plan_id,
    current_plan,
    requested_months,
    NULLIF(trim(contact_phone), ''),
    NULLIF(current_email, ''),
    NULLIF(trim(payment_method), ''),
    NULLIF(trim(payment_reference), ''),
    NULLIF(trim(user_notes), '')
  )
  RETURNING id INTO request_id;

  INSERT INTO public.audit_logs (
    business_id,
    actor_id,
    user_id,
    user_email,
    action,
    resource,
    details,
    area
  )
  VALUES (
    v_business_id,
    auth.uid(),
    auth.uid(),
    current_email,
    'Solicitar Plan',
    'Plan Premium',
    jsonb_build_object(
      'request_id', request_id,
      'current_plan', current_plan,
      'requested_plan', target_plan_id,
      'requested_months', requested_months
    ),
    'Planes'
  );

  RETURN json_build_object('request_id', request_id, 'status', 'pending');
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_plan_change(text, integer, text, text, text, text) TO authenticated;

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
EXCEPTION
  WHEN others THEN
    NULL;
END;
$$;

