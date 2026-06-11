-- Fix PL/pgSQL ambiguity between parameter name and column name `admin_notes`.

CREATE OR REPLACE FUNCTION public.approve_plan_change_request(
  request_id uuid,
  approved_months integer DEFAULT NULL,
  admin_notes text DEFAULT NULL
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
  period_start timestamptz;
  period_end timestamptz;
  admin_email text;
  v_admin_notes text;
BEGIN
  IF NOT public.is_system_admin() THEN
    RAISE EXCEPTION 'Solo un administrador del sistema puede aprobar solicitudes' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO req
  FROM public.plan_change_requests
  WHERE id = request_id
  FOR UPDATE;

  IF req.id IS NULL THEN
    RAISE EXCEPTION 'Solicitud no encontrada' USING ERRCODE = 'P0001';
  END IF;

  IF req.status <> 'pending' THEN
    RAISE EXCEPTION 'La solicitud ya fue procesada' USING ERRCODE = 'P0001';
  END IF;

  months := COALESCE(approved_months, req.requested_months, 1);
  IF months < 1 THEN
    months := 1;
  END IF;

  v_admin_notes := NULLIF(trim(admin_notes), '');
  period_start := now();
  period_end := period_start + make_interval(months => months);
  admin_email := public.get_current_user_email();

  INSERT INTO public.subscriptions (
    user_id,
    plan_id,
    status,
    current_period_start,
    current_period_end,
    source,
    approved_by,
    approved_at,
    admin_notes,
    created_at,
    updated_at
  )
  VALUES (
    req.business_id,
    req.requested_plan_id,
    'active',
    period_start,
    period_end,
    'manual',
    auth.uid(),
    now(),
    v_admin_notes,
    now(),
    now()
  )
  ON CONFLICT (user_id) DO UPDATE
  SET plan_id = excluded.plan_id,
      status = excluded.status,
      current_period_start = excluded.current_period_start,
      current_period_end = excluded.current_period_end,
      source = excluded.source,
      approved_by = excluded.approved_by,
      approved_at = excluded.approved_at,
      admin_notes = excluded.admin_notes,
      trial_start_at = NULL,
      trial_end_at = NULL,
      cancelled_by = NULL,
      cancelled_at = NULL,
      updated_at = now();

  UPDATE public.plan_change_requests
  SET status = 'approved',
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      admin_notes = v_admin_notes,
      updated_at = now()
  WHERE id = req.id;

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
    req.business_id,
    auth.uid(),
    auth.uid(),
    admin_email,
    'Aprobar Plan',
    'Plan Premium',
    jsonb_build_object(
      'request_id', req.id,
      'approved_plan', req.requested_plan_id,
      'approved_months', months,
      'period_end', period_end
    ),
    'Planes'
  );

  RETURN json_build_object(
    'request_id', req.id,
    'business_id', req.business_id,
    'plan_id', req.requested_plan_id,
    'status', 'approved',
    'current_period_end', period_end
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_plan_change_request(uuid, integer, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.reject_plan_change_request(
  request_id uuid,
  admin_notes text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
DECLARE
  req record;
  admin_email text;
  v_admin_notes text;
BEGIN
  IF NOT public.is_system_admin() THEN
    RAISE EXCEPTION 'Solo un administrador del sistema puede rechazar solicitudes' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO req
  FROM public.plan_change_requests
  WHERE id = request_id
  FOR UPDATE;

  IF req.id IS NULL THEN
    RAISE EXCEPTION 'Solicitud no encontrada' USING ERRCODE = 'P0001';
  END IF;

  IF req.status <> 'pending' THEN
    RAISE EXCEPTION 'La solicitud ya fue procesada' USING ERRCODE = 'P0001';
  END IF;

  v_admin_notes := NULLIF(trim(admin_notes), '');
  admin_email := public.get_current_user_email();

  UPDATE public.plan_change_requests
  SET status = 'rejected',
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      admin_notes = v_admin_notes,
      updated_at = now()
  WHERE id = req.id;

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
    req.business_id,
    auth.uid(),
    auth.uid(),
    admin_email,
    'Rechazar Plan',
    'Plan Premium',
    jsonb_build_object('request_id', req.id, 'requested_plan', req.requested_plan_id),
    'Planes'
  );

  RETURN json_build_object('request_id', req.id, 'status', 'rejected');
END;
$$;

GRANT EXECUTE ON FUNCTION public.reject_plan_change_request(uuid, text) TO authenticated;

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
EXCEPTION
  WHEN others THEN
    NULL;
END;
$$;

