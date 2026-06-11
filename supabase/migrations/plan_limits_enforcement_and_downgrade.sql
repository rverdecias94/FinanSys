DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'inventory_areas'
      AND column_name = 'plan_locked'
  ) THEN
    NULL;
  ELSE
    ALTER TABLE public.inventory_areas
      ADD COLUMN plan_locked boolean NOT NULL DEFAULT false;
  END IF;
END $$;

UPDATE public.plans
SET limits = jsonb_build_object(
  'monthly_transactions', 40,
  'products', 40,
  'areas', 5,
  'partners', 0
),
features = COALESCE(features, '{}'::jsonb) || jsonb_build_object(
  'reports_export', false,
  'audit_logs', false,
  'custom_branding', false,
  'watermark', true
)
WHERE id = 'free';

UPDATE public.plans
SET limits = COALESCE(limits, '{}'::jsonb) || jsonb_build_object(
  'monthly_transactions', -1,
  'products', -1,
  'areas', -1,
  'partners', 5
),
features = COALESCE(features, '{}'::jsonb) || jsonb_build_object(
  'reports_export', true,
  'audit_logs', true,
  'custom_branding', true,
  'watermark', false
)
WHERE id = 'premium';

CREATE OR REPLACE FUNCTION public.get_business_plan_id(target_business_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
  SELECT COALESCE(
    (SELECT s.plan_id
     FROM public.subscriptions s
     WHERE s.user_id = target_business_id
     LIMIT 1),
    'free'
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_business_plan_id(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_plan_limit(target_business_id uuid, metric_key text)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
DECLARE
  pid text;
  v text;
  n integer;
BEGIN
  pid := public.get_business_plan_id(target_business_id);
  SELECT p.limits ->> metric_key INTO v
  FROM public.plans p
  WHERE p.id = pid
  LIMIT 1;

  IF v IS NULL THEN
    IF metric_key = 'monthly_transactions' THEN
      RETURN 40;
    ELSIF metric_key = 'products' THEN
      RETURN 40;
    ELSIF metric_key = 'areas' THEN
      RETURN 5;
    ELSIF metric_key = 'partners' THEN
      RETURN 0;
    END IF;
    RETURN 0;
  END IF;

  n := v::integer;
  RETURN n;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_plan_limit(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.enforce_transactions_monthly_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
DECLARE
  business_id uuid;
  limit_n integer;
  tx_date timestamptz;
  start_month timestamptz;
  next_month timestamptz;
  current_count integer;
BEGIN
  business_id := COALESCE(NEW.user_id, public.get_current_business_id());
  limit_n := public.get_plan_limit(business_id, 'monthly_transactions');
  IF limit_n < 0 THEN
    RETURN NEW;
  END IF;

  tx_date := COALESCE(NEW.date, now());
  start_month := date_trunc('month', tx_date);
  next_month := start_month + interval '1 month';

  SELECT COUNT(*) INTO current_count
  FROM public.transactions t
  WHERE t.user_id = business_id
    AND t.date >= start_month
    AND t.date < next_month;

  IF current_count >= limit_n THEN
    RAISE EXCEPTION 'Límite del plan alcanzado (transacciones mensuales)'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_products_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
DECLARE
  business_id uuid;
  limit_n integer;
  current_count integer;
BEGIN
  business_id := COALESCE(NEW.user_id, public.get_current_business_id());
  limit_n := public.get_plan_limit(business_id, 'products');
  IF limit_n < 0 THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO current_count
  FROM public.products p
  WHERE p.user_id = business_id;

  IF current_count >= limit_n THEN
    RAISE EXCEPTION 'Límite del plan alcanzado (productos)'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_inventory_areas_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
DECLARE
  business_id uuid;
  limit_n integer;
  current_count integer;
BEGIN
  business_id := COALESCE(NEW.user_id, public.get_current_business_id());
  limit_n := public.get_plan_limit(business_id, 'areas');
  IF limit_n < 0 THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO current_count
  FROM public.inventory_areas a
  WHERE a.user_id = business_id;

  IF current_count >= limit_n THEN
    RAISE EXCEPTION 'Límite del plan alcanzado (áreas de inventario)'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_inventory_area_update_if_locked()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
DECLARE
  bypass text;
BEGIN
  bypass := current_setting('app.bypass_plan_lock', true);
  IF bypass = '1' THEN
    RETURN NEW;
  END IF;

  IF OLD.plan_locked IS TRUE THEN
    RAISE EXCEPTION 'Área bloqueada por plan'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_transactions_monthly_limit ON public.transactions;
CREATE TRIGGER trg_enforce_transactions_monthly_limit
BEFORE INSERT ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.enforce_transactions_monthly_limit();

DROP TRIGGER IF EXISTS trg_enforce_products_limit ON public.products;
CREATE TRIGGER trg_enforce_products_limit
BEFORE INSERT ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.enforce_products_limit();

DROP TRIGGER IF EXISTS trg_enforce_inventory_areas_limit ON public.inventory_areas;
CREATE TRIGGER trg_enforce_inventory_areas_limit
BEFORE INSERT ON public.inventory_areas
FOR EACH ROW
EXECUTE FUNCTION public.enforce_inventory_areas_limit();

DROP TRIGGER IF EXISTS trg_enforce_inventory_area_update_if_locked ON public.inventory_areas;
CREATE TRIGGER trg_enforce_inventory_area_update_if_locked
BEFORE UPDATE ON public.inventory_areas
FOR EACH ROW
EXECUTE FUNCTION public.enforce_inventory_area_update_if_locked();

CREATE OR REPLACE FUNCTION public.apply_subscription_policies(target_business_id uuid, new_plan_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
DECLARE
  keep_currency_id bigint;
BEGIN
  IF new_plan_id = 'free' THEN
    PERFORM set_config('app.bypass_plan_lock', '1', true);

    WITH ranked AS (
      SELECT id,
             row_number() OVER (ORDER BY created_at ASC, id ASC) AS rn
      FROM public.inventory_areas
      WHERE user_id = target_business_id
    )
    UPDATE public.inventory_areas a
    SET plan_locked = (ranked.rn > 5)
    FROM ranked
    WHERE a.id = ranked.id;

    UPDATE public.team_members
    SET status = 'revoked',
        updated_at = now()
    WHERE owner_id = target_business_id
      AND status = 'active';

    SELECT bc.id INTO keep_currency_id
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

CREATE OR REPLACE FUNCTION public.on_subscription_plan_changed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.apply_subscription_policies(NEW.user_id, NEW.plan_id);
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.plan_id IS DISTINCT FROM OLD.plan_id THEN
      PERFORM public.apply_subscription_policies(NEW.user_id, NEW.plan_id);
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_on_subscription_plan_changed ON public.subscriptions;
CREATE TRIGGER trg_on_subscription_plan_changed
AFTER INSERT OR UPDATE OF plan_id ON public.subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.on_subscription_plan_changed();

