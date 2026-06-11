-- Manual plan change requests for markets where in-app payments are not available.

CREATE TABLE IF NOT EXISTS public.system_admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'support', 'super_admin')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.system_admins ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_system_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.system_admins sa
    WHERE sa.user_id = auth.uid()
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_system_admin() TO authenticated;

DROP POLICY IF EXISTS system_admins_read_self ON public.system_admins;
CREATE POLICY system_admins_read_self
ON public.system_admins
FOR SELECT
USING (auth.uid() = user_id OR public.is_system_admin());

CREATE TABLE IF NOT EXISTS public.plan_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requested_plan_id text NOT NULL REFERENCES public.plans(id),
  current_plan_id text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  requested_months integer NOT NULL DEFAULT 1 CHECK (requested_months > 0),
  contact_phone text,
  contact_email text,
  payment_method text,
  payment_reference text,
  user_notes text,
  admin_notes text,
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_plan_change_requests_business
ON public.plan_change_requests (business_id);

CREATE INDEX IF NOT EXISTS idx_plan_change_requests_status_created
ON public.plan_change_requests (status, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_plan_change_requests_one_pending_per_business
ON public.plan_change_requests (business_id)
WHERE status = 'pending';

ALTER TABLE public.plan_change_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS plan_change_requests_read ON public.plan_change_requests;
CREATE POLICY plan_change_requests_read
ON public.plan_change_requests
FOR SELECT
USING (
  auth.uid() = business_id
  OR public.is_member_of_team(business_id)
  OR public.is_system_admin()
);

DROP POLICY IF EXISTS plan_change_requests_owner_insert ON public.plan_change_requests;
CREATE POLICY plan_change_requests_owner_insert
ON public.plan_change_requests
FOR INSERT
WITH CHECK (
  auth.uid() = business_id
  AND requested_by = auth.uid()
);

DROP POLICY IF EXISTS plan_change_requests_admin_update ON public.plan_change_requests;
CREATE POLICY plan_change_requests_admin_update
ON public.plan_change_requests
FOR UPDATE
USING (public.is_system_admin())
WITH CHECK (public.is_system_admin());

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS admin_notes text;

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own subscription" ON public.subscriptions;
DROP POLICY IF EXISTS "Users and team members can view subscription" ON public.subscriptions;
DROP POLICY IF EXISTS "Only owners can manage subscription" ON public.subscriptions;
DROP POLICY IF EXISTS subscriptions_read ON public.subscriptions;
DROP POLICY IF EXISTS subscriptions_manage_owner_only ON public.subscriptions;
DROP POLICY IF EXISTS subscriptions_owner_insert_free ON public.subscriptions;
DROP POLICY IF EXISTS subscriptions_owner_update_to_free ON public.subscriptions;

CREATE POLICY subscriptions_read
ON public.subscriptions
FOR SELECT
USING (
  auth.uid() = user_id
  OR public.is_member_of_team(user_id)
  OR public.is_system_admin()
);

CREATE POLICY subscriptions_owner_insert_free
ON public.subscriptions
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND plan_id = 'free'
);

CREATE POLICY subscriptions_owner_update_to_free
ON public.subscriptions
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND plan_id = 'free'
);

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
  business_id uuid;
  current_plan text;
  request_id uuid;
  current_email text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado' USING ERRCODE = 'P0001';
  END IF;

  business_id := public.get_current_business_id();
  IF business_id IS NULL OR business_id <> auth.uid() THEN
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
  WHERE s.user_id = business_id
  LIMIT 1;
  current_plan := COALESCE(current_plan, 'free');

  IF current_plan = target_plan_id THEN
    RAISE EXCEPTION 'El negocio ya tiene ese plan activo' USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.plan_change_requests pcr
    WHERE pcr.business_id = business_id
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
    business_id,
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
    business_id,
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

  UPDATE public.plan_change_requests
  SET status = 'approved',
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      admin_notes = NULLIF(trim(admin_notes), ''),
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

  admin_email := public.get_current_user_email();

  UPDATE public.plan_change_requests
  SET status = 'rejected',
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      admin_notes = NULLIF(trim(admin_notes), ''),
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

CREATE OR REPLACE FUNCTION public.expire_past_due_subscriptions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
DECLARE
  affected integer;
BEGIN
  IF NOT public.is_system_admin() THEN
    RAISE EXCEPTION 'Solo un administrador del sistema puede vencer suscripciones' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.subscriptions
  SET plan_id = 'free',
      status = 'cancelled',
      cancelled_by = auth.uid(),
      cancelled_at = now(),
      updated_at = now()
  WHERE plan_id = 'premium'
    AND current_period_end IS NOT NULL
    AND current_period_end < now();

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

GRANT EXECUTE ON FUNCTION public.expire_past_due_subscriptions() TO authenticated;
