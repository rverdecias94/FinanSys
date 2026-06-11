CREATE OR REPLACE FUNCTION public.cancel_my_pending_plan_change_request()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
DECLARE
  v_business_id uuid;
  req record;
  current_email text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado' USING ERRCODE = 'P0001';
  END IF;

  v_business_id := public.get_current_business_id();
  IF v_business_id IS NULL OR v_business_id <> auth.uid() THEN
    RAISE EXCEPTION 'Solo el propietario puede cancelar solicitudes' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO req
  FROM public.plan_change_requests
  WHERE business_id = v_business_id
    AND status = 'pending'
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF req.id IS NULL THEN
    RAISE EXCEPTION 'No hay solicitud pendiente' USING ERRCODE = 'P0001';
  END IF;

  current_email := public.get_current_user_email();

  UPDATE public.plan_change_requests
  SET status = 'cancelled',
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
    v_business_id,
    auth.uid(),
    auth.uid(),
    current_email,
    'Cancelar Solicitud',
    'Plan Premium',
    jsonb_build_object('request_id', req.id),
    'Planes'
  );

  RETURN json_build_object('request_id', req.id, 'status', 'cancelled');
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_my_pending_plan_change_request() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_business_plan(
  target_business_id uuid,
  target_plan_id text,
  months integer DEFAULT NULL,
  admin_notes text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
DECLARE
  m integer;
  period_start timestamptz;
  period_end timestamptz;
  admin_email text;
BEGIN
  IF NOT public.is_system_admin() THEN
    RAISE EXCEPTION 'Solo un administrador del sistema puede cambiar planes' USING ERRCODE = 'P0001';
  END IF;

  IF target_business_id IS NULL THEN
    RAISE EXCEPTION 'business_id requerido' USING ERRCODE = 'P0001';
  END IF;

  IF target_plan_id IS NULL OR target_plan_id NOT IN ('free', 'premium') THEN
    RAISE EXCEPTION 'plan_id inválido' USING ERRCODE = 'P0001';
  END IF;

  admin_email := public.get_current_user_email();

  IF target_plan_id = 'premium' THEN
    m := COALESCE(months, 1);
    IF m < 1 THEN
      m := 1;
    END IF;
    period_start := now();
    period_end := period_start + make_interval(months => m);

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
      target_business_id,
      'premium',
      'active',
      period_start,
      period_end,
      'admin',
      auth.uid(),
      now(),
      NULLIF(trim(admin_notes), ''),
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
  ELSE
    INSERT INTO public.subscriptions (
      user_id,
      plan_id,
      status,
      current_period_start,
      current_period_end,
      source,
      cancelled_by,
      cancelled_at,
      admin_notes,
      created_at,
      updated_at
    )
    VALUES (
      target_business_id,
      'free',
      'cancelled',
      now(),
      NULL,
      'admin',
      auth.uid(),
      now(),
      NULLIF(trim(admin_notes), ''),
      now(),
      now()
    )
    ON CONFLICT (user_id) DO UPDATE
    SET plan_id = excluded.plan_id,
        status = excluded.status,
        current_period_start = excluded.current_period_start,
        current_period_end = excluded.current_period_end,
        source = excluded.source,
        cancelled_by = excluded.cancelled_by,
        cancelled_at = excluded.cancelled_at,
        approved_by = NULL,
        approved_at = NULL,
        admin_notes = excluded.admin_notes,
        trial_start_at = NULL,
        trial_end_at = NULL,
        updated_at = now();
  END IF;

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
    target_business_id,
    auth.uid(),
    auth.uid(),
    admin_email,
    'Cambio Manual de Plan',
    'Suscripción',
    jsonb_build_object(
      'plan_id', target_plan_id,
      'months', months,
      'current_period_end', period_end
    ),
    'Planes'
  );

  RETURN json_build_object(
    'business_id', target_business_id,
    'plan_id', target_plan_id,
    'current_period_end', period_end
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_set_business_plan(uuid, text, integer, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.expire_past_due_subscriptions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
DECLARE
  affected integer;
  admin_email text;
BEGIN
  IF NOT public.is_system_admin() THEN
    RAISE EXCEPTION 'Solo un administrador del sistema puede vencer suscripciones' USING ERRCODE = 'P0001';
  END IF;

  admin_email := public.get_current_user_email();

  WITH affected_rows AS (
    UPDATE public.subscriptions
    SET plan_id = 'free',
        status = 'cancelled',
        cancelled_by = auth.uid(),
        cancelled_at = now(),
        source = 'admin',
        updated_at = now()
    WHERE plan_id = 'premium'
      AND current_period_end IS NOT NULL
      AND current_period_end < now()
    RETURNING user_id, current_period_end
  )
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
  SELECT
    ar.user_id,
    auth.uid(),
    auth.uid(),
    admin_email,
    'Vencimiento Automático',
    'Suscripción',
    jsonb_build_object('previous_period_end', ar.current_period_end),
    'Planes'
  FROM affected_rows ar;

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

GRANT EXECUTE ON FUNCTION public.expire_past_due_subscriptions() TO authenticated;

CREATE OR REPLACE FUNCTION public.request_plan_change(
  contact_phone text,
  payment_method text,
  payment_reference text,
  requested_months integer,
  target_plan_id text,
  user_notes text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
BEGIN
  RETURN public.request_plan_change(
    target_plan_id := target_plan_id,
    requested_months := requested_months,
    contact_phone := contact_phone,
    payment_method := payment_method,
    payment_reference := payment_reference,
    user_notes := user_notes
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_plan_change(text, text, text, integer, text, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
