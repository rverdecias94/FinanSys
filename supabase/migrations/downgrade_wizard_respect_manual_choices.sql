CREATE OR REPLACE FUNCTION public.apply_subscription_policies(target_business_id uuid, new_plan_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
DECLARE
  keep_currency_id bigint;
  limit_areas integer;
  manual text;
BEGIN
  manual := current_setting('app.manual_downgrade_choices', true);

  IF new_plan_id = 'free' THEN
    UPDATE public.team_members
    SET status = 'revoked',
        updated_at = now()
    WHERE owner_id = target_business_id
      AND status IN ('active', 'pending');

    IF manual = '1' THEN
      RETURN;
    END IF;

    PERFORM set_config('app.bypass_plan_lock', '1', true);

    limit_areas := public.get_plan_limit(target_business_id, 'areas');
    IF limit_areas IS NULL OR limit_areas < 0 THEN
      limit_areas := 0;
    END IF;

    WITH ranked AS (
      SELECT id,
             row_number() OVER (ORDER BY created_at ASC, id ASC) AS rn
      FROM public.inventory_areas
      WHERE user_id = target_business_id
    )
    UPDATE public.inventory_areas a
    SET plan_locked = (ranked.rn > limit_areas)
    FROM ranked
    WHERE a.id = ranked.id;

    SELECT bc.id
    INTO keep_currency_id
    FROM public.business_currencies bc
    WHERE bc.user_id = target_business_id
      AND bc.is_active = true
    ORDER BY bc.is_default DESC, bc.created_at ASC, bc.id ASC
    LIMIT 1;

    IF keep_currency_id IS NOT NULL THEN
      UPDATE public.business_currencies
      SET is_active = (id = keep_currency_id),
          is_default = (id = keep_currency_id)
      WHERE user_id = target_business_id;
    END IF;

    PERFORM set_config('app.bypass_plan_lock', '0', true);
    RETURN;
  END IF;

  PERFORM set_config('app.bypass_plan_lock', '1', true);
  UPDATE public.inventory_areas
  SET plan_locked = false
  WHERE user_id = target_business_id;
  PERFORM set_config('app.bypass_plan_lock', '0', true);
END;
$$;

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
EXCEPTION
  WHEN others THEN
    NULL;
END;
$$;
