CREATE OR REPLACE FUNCTION public.get_my_downgrade_preview()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
DECLARE
  v_business_id uuid;
  current_plan text;
  free_limits jsonb;
  free_features jsonb;
  premium_features jsonb;
  start_month timestamptz;
  next_month timestamptz;
  tx_count integer;
  prod_count integer;
  area_count integer;
  partner_count integer;
  currency_count integer;
  features_lost text[];
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado' USING ERRCODE = 'P0001';
  END IF;

  v_business_id := public.get_current_business_id();
  IF v_business_id IS NULL OR v_business_id <> auth.uid() THEN
    RAISE EXCEPTION 'Solo el propietario puede ejecutar el downgrade' USING ERRCODE = 'P0001';
  END IF;

  SELECT COALESCE(s.plan_id, 'free')
  INTO current_plan
  FROM public.subscriptions s
  WHERE s.user_id = v_business_id
  LIMIT 1;
  current_plan := COALESCE(current_plan, 'free');

  SELECT p.limits, p.features
  INTO free_limits, free_features
  FROM public.plans p
  WHERE p.id = 'free'
  LIMIT 1;

  SELECT p.features
  INTO premium_features
  FROM public.plans p
  WHERE p.id = 'premium'
  LIMIT 1;

  start_month := date_trunc('month', now());
  next_month := start_month + interval '1 month';

  SELECT COUNT(*)
  INTO tx_count
  FROM public.transactions t
  WHERE t.user_id = v_business_id
    AND t.date >= start_month
    AND t.date < next_month;

  SELECT COUNT(*)
  INTO prod_count
  FROM public.products p
  WHERE p.user_id = v_business_id;

  SELECT COUNT(*)
  INTO area_count
  FROM public.inventory_areas a
  WHERE a.user_id = v_business_id;

  SELECT COUNT(*)
  INTO partner_count
  FROM public.team_members tm
  WHERE tm.owner_id = v_business_id
    AND tm.status IN ('pending', 'active');

  SELECT COUNT(*)
  INTO currency_count
  FROM public.business_currencies bc
  WHERE bc.user_id = v_business_id
    AND bc.is_active = true;

  SELECT COALESCE(array_agg(k ORDER BY k), ARRAY[]::text[])
  INTO features_lost
  FROM (
    SELECT k
    FROM jsonb_object_keys(COALESCE(premium_features, '{}'::jsonb)) AS k
    WHERE COALESCE((premium_features ->> k)::boolean, false) = true
      AND COALESCE((free_features ->> k)::boolean, false) = false
  ) s;

  RETURN jsonb_build_object(
    'current_plan', current_plan,
    'free_limits', COALESCE(free_limits, '{}'::jsonb),
    'usage', jsonb_build_object(
      'monthly_transactions', COALESCE(tx_count, 0),
      'products', COALESCE(prod_count, 0),
      'areas', COALESCE(area_count, 0),
      'partners', COALESCE(partner_count, 0),
      'active_currencies', COALESCE(currency_count, 0)
    ),
    'features_lost', to_jsonb(COALESCE(features_lost, ARRAY[]::text[]))
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_downgrade_preview() TO authenticated;

CREATE OR REPLACE FUNCTION public.apply_downgrade_to_free(
  keep_currency_id bigint,
  keep_area_ids bigint[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
DECLARE
  v_business_id uuid;
  current_plan text;
  area_limit integer;
  chosen_currency_id bigint;
  selected_area_ids bigint[];
  selected_area_count integer;
  current_email text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado' USING ERRCODE = 'P0001';
  END IF;

  v_business_id := public.get_current_business_id();
  IF v_business_id IS NULL OR v_business_id <> auth.uid() THEN
    RAISE EXCEPTION 'Solo el propietario puede ejecutar el downgrade' USING ERRCODE = 'P0001';
  END IF;

  SELECT COALESCE(s.plan_id, 'free')
  INTO current_plan
  FROM public.subscriptions s
  WHERE s.user_id = v_business_id
  LIMIT 1;
  current_plan := COALESCE(current_plan, 'free');

  IF current_plan <> 'premium' THEN
    RAISE EXCEPTION 'Solo se permite downgrade cuando el negocio está en Premium' USING ERRCODE = 'P0001';
  END IF;

  SELECT COALESCE(NULLIF((p.limits ->> 'areas'), '')::integer, 5)
  INTO area_limit
  FROM public.plans p
  WHERE p.id = 'free'
  LIMIT 1;
  area_limit := COALESCE(area_limit, 5);

  IF keep_currency_id IS NULL THEN
    SELECT bc.id
    INTO chosen_currency_id
    FROM public.business_currencies bc
    WHERE bc.user_id = v_business_id
      AND bc.is_active = true
    ORDER BY bc.is_default DESC, bc.created_at ASC, bc.id ASC
    LIMIT 1;
  ELSE
    SELECT bc.id
    INTO chosen_currency_id
    FROM public.business_currencies bc
    WHERE bc.user_id = v_business_id
      AND bc.id = keep_currency_id
      AND bc.is_active = true
    LIMIT 1;
  END IF;

  IF chosen_currency_id IS NULL THEN
    RAISE EXCEPTION 'Debes seleccionar una moneda activa para conservar' USING ERRCODE = 'P0001';
  END IF;

  IF keep_area_ids IS NULL OR array_length(keep_area_ids, 1) IS NULL OR array_length(keep_area_ids, 1) = 0 THEN
    SELECT COALESCE(array_agg(id ORDER BY created_at ASC, id ASC), ARRAY[]::bigint[])
    INTO selected_area_ids
    FROM (
      SELECT a.id, a.created_at
      FROM public.inventory_areas a
      WHERE a.user_id = v_business_id
      ORDER BY a.created_at ASC, a.id ASC
      LIMIT area_limit
    ) q;
  ELSE
    SELECT COALESCE(array_agg(DISTINCT x), ARRAY[]::bigint[])
    INTO selected_area_ids
    FROM unnest(keep_area_ids) AS x;
  END IF;

  selected_area_count := COALESCE(array_length(selected_area_ids, 1), 0);
  IF selected_area_count > area_limit THEN
    RAISE EXCEPTION 'Solo puedes conservar hasta % áreas editables', area_limit USING ERRCODE = 'P0001';
  END IF;

  IF selected_area_count > 0 AND EXISTS (
    SELECT 1
    FROM unnest(selected_area_ids) AS aid
    LEFT JOIN public.inventory_areas a
      ON a.id = aid
     AND a.user_id = v_business_id
    WHERE a.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Una o más áreas seleccionadas no pertenecen a este negocio' USING ERRCODE = 'P0001';
  END IF;

  PERFORM set_config('app.manual_downgrade_choices', '1', true);
  PERFORM set_config('app.bypass_plan_lock', '1', true);

  UPDATE public.inventory_areas a
  SET plan_locked = CASE
    WHEN selected_area_count = 0 THEN true
    ELSE NOT (a.id = ANY(selected_area_ids))
  END
  WHERE a.user_id = v_business_id;

  UPDATE public.business_currencies
  SET is_active = (id = chosen_currency_id),
      is_default = (id = chosen_currency_id)
  WHERE user_id = v_business_id;

  UPDATE public.team_members
  SET status = 'revoked',
      updated_at = now()
  WHERE owner_id = v_business_id
    AND status IN ('active', 'pending');

  UPDATE public.subscriptions
  SET plan_id = 'free',
      status = 'active',
      trial_start_at = NULL,
      trial_end_at = NULL,
      updated_at = now()
  WHERE user_id = v_business_id;

  current_email := public.get_current_user_email();

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
    'Downgrade',
    'Plan Gratuito',
    jsonb_build_object(
      'from', current_plan,
      'to', 'free',
      'keep_currency_id', chosen_currency_id,
      'keep_area_ids', selected_area_ids
    ),
    'Planes'
  );

  PERFORM set_config('app.bypass_plan_lock', '0', true);

  RETURN jsonb_build_object(
    'status', 'ok',
    'plan_id', 'free',
    'keep_currency_id', chosen_currency_id,
    'keep_area_ids', selected_area_ids
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_downgrade_to_free(bigint, bigint[]) TO authenticated;

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
EXCEPTION
  WHEN others THEN
    NULL;
END;
$$;
