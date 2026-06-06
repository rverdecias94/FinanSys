-- RBAC hardening v2: enforce roles at DB level, remove conflicting policies, and secure team flows.

-- 0) Utilities
CREATE OR REPLACE FUNCTION public.get_current_user_email()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
  SELECT NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email';
$$;

CREATE OR REPLACE FUNCTION public.get_current_business_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
  SELECT COALESCE(
    (SELECT tm.owner_id
     FROM public.team_members tm
     WHERE tm.member_id = auth.uid()
       AND tm.status = 'active'
     ORDER BY tm.created_at ASC
     LIMIT 1),
    auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_member_of_team(target_owner_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.team_members tm
    WHERE tm.member_id = auth.uid()
      AND tm.owner_id = target_owner_id
      AND tm.status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.has_permission_secure(target_owner_id uuid, perm_code text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
  SELECT CASE
    WHEN auth.uid() = target_owner_id THEN TRUE
    ELSE EXISTS (
      SELECT 1
      FROM public.team_members tm
      JOIN public.role_permissions rp ON rp.role_id = tm.role_id
      JOIN public.permissions p ON p.id = rp.permission_id
      WHERE tm.member_id = auth.uid()
        AND tm.owner_id = target_owner_id
        AND tm.status = 'active'
        AND p.code = perm_code
    )
  END;
$$;

GRANT EXECUTE ON FUNCTION public.get_current_user_email TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_current_business_id TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_member_of_team TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_permission_secure TO authenticated;

-- 1) Normalize membership status and tighten semantics
UPDATE public.team_members
SET status = 'active'
WHERE status = 'accepted';

ALTER TABLE public.team_members
  DROP CONSTRAINT IF EXISTS team_members_status_check;

ALTER TABLE public.team_members
  ADD CONSTRAINT team_members_status_check
  CHECK (status IN ('pending', 'active', 'revoked'));

-- 2) Secure invitation acceptance (no user_uuid spoofing)
DROP FUNCTION IF EXISTS public.accept_invitation_by_email_with_user(text, uuid);

CREATE OR REPLACE FUNCTION public.accept_invitation_for_current_user(email_input text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
DECLARE
  current_email text;
BEGIN
  current_email := public.get_current_user_email();
  IF current_email IS NULL THEN
    RAISE EXCEPTION 'No authenticated email found';
  END IF;

  IF email_input IS NULL OR lower(email_input) <> lower(current_email) THEN
    RAISE EXCEPTION 'Email mismatch';
  END IF;

  UPDATE public.team_members
  SET member_id = auth.uid(),
      status = 'active',
      updated_at = now()
  WHERE lower(member_email) = lower(current_email)
    AND status = 'pending'
    AND (member_id IS NULL OR member_id = auth.uid());

  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_invitation_for_current_user TO authenticated;

-- 3) Business context: always deterministic, never heuristic
DROP FUNCTION IF EXISTS public.get_user_business_context(uuid);

CREATE OR REPLACE FUNCTION public.get_user_business_context(user_uuid uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
DECLARE
  member_record record;
  perms text[];
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF user_uuid IS NULL OR user_uuid <> auth.uid() THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT tm.owner_id, tm.role_id
  INTO member_record
  FROM public.team_members tm
  WHERE tm.member_id = user_uuid
    AND tm.status = 'active'
  ORDER BY tm.created_at ASC
  LIMIT 1;

  IF member_record.owner_id IS NOT NULL THEN
    SELECT COALESCE(array_agg(DISTINCT p.code ORDER BY p.code), ARRAY[]::text[])
    INTO perms
    FROM public.role_permissions rp
    JOIN public.permissions p ON p.id = rp.permission_id
    WHERE rp.role_id = member_record.role_id;

    RETURN json_build_object(
      'businessId', member_record.owner_id,
      'isOwner', false,
      'roleId', member_record.role_id,
      'permissions', perms
    );
  END IF;

  RETURN json_build_object(
    'businessId', user_uuid,
    'isOwner', true,
    'roleId', null,
    'permissions', ARRAY['*']::text[]
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_business_context TO authenticated;

-- 4) Seed/align required system roles
DO $$
DECLARE
  admin_role_id uuid;
  editor_role_id uuid;
  consultor_role_id uuid;
BEGIN
  -- Administrador
  SELECT id INTO admin_role_id FROM public.roles WHERE name = 'Administrador' AND is_system = true LIMIT 1;
  IF admin_role_id IS NULL THEN
    INSERT INTO public.roles (name, description, is_system)
    VALUES ('Administrador', 'Acceso total: configuración, equipo, auditoría y operativa completa.', true)
    RETURNING id INTO admin_role_id;
  ELSE
    UPDATE public.roles SET description = 'Acceso total: configuración, equipo, auditoría y operativa completa.' WHERE id = admin_role_id;
  END IF;

  DELETE FROM public.role_permissions WHERE role_id = admin_role_id;
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT admin_role_id, id FROM public.permissions;

  -- Editor (reutiliza si existe)
  SELECT id INTO editor_role_id FROM public.roles WHERE name = 'Editor' AND is_system = true LIMIT 1;
  IF editor_role_id IS NULL THEN
    INSERT INTO public.roles (name, description, is_system)
    VALUES ('Editor', 'Operativa completa (Finanzas, Almacén, Inventario, Reportes). Sin configuración ni auditoría.', true)
    RETURNING id INTO editor_role_id;
  ELSE
    UPDATE public.roles SET description = 'Operativa completa (Finanzas, Almacén, Inventario, Reportes). Sin configuración ni auditoría.' WHERE id = editor_role_id;
  END IF;

  DELETE FROM public.role_permissions WHERE role_id = editor_role_id;
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT editor_role_id, id FROM public.permissions
  WHERE code IN (
    'dashboard.view',
    'finanzas.view', 'finanzas.create', 'finanzas.edit', 'finanzas.delete', 'finanzas.export',
    'warehouse.view', 'warehouse.create', 'warehouse.edit', 'warehouse.delete', 'warehouse.move',
    'inventory.view', 'inventory.create', 'inventory.edit', 'inventory.delete', 'inventory.move',
    'reports.view', 'reports.export'
  );

  -- Consultor
  SELECT id INTO consultor_role_id FROM public.roles WHERE name = 'Consultor' AND is_system = true LIMIT 1;
  IF consultor_role_id IS NULL THEN
    INSERT INTO public.roles (name, description, is_system)
    VALUES ('Consultor', 'Solo lectura con exportación. Sin modificaciones, configuración ni auditoría.', true)
    RETURNING id INTO consultor_role_id;
  ELSE
    UPDATE public.roles SET description = 'Solo lectura con exportación. Sin modificaciones, configuración ni auditoría.' WHERE id = consultor_role_id;
  END IF;

  DELETE FROM public.role_permissions WHERE role_id = consultor_role_id;
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT consultor_role_id, id FROM public.permissions
  WHERE code IN (
    'dashboard.view',
    'finanzas.view', 'finanzas.export',
    'warehouse.view',
    'inventory.view',
    'reports.view', 'reports.export'
  );
END $$;

-- 5) Default user_id on key tables to avoid NULL ownership
ALTER TABLE public.transactions ALTER COLUMN user_id SET DEFAULT public.get_current_business_id();
ALTER TABLE public.products ALTER COLUMN user_id SET DEFAULT public.get_current_business_id();
ALTER TABLE public.movements ALTER COLUMN user_id SET DEFAULT public.get_current_business_id();

-- 6) Drop ALL existing policies for target tables (avoid collisions)
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT schemaname, tablename, policyname FROM pg_policies
           WHERE schemaname = 'public'
             AND tablename IN (
               'team_members', 'roles', 'permissions', 'role_permissions',
               'transactions', 'products', 'movements',
               'inventory_areas', 'inventory_area_fields', 'inventory_items', 'inventory_area_prefixes',
               'business_currencies', 'business_balances', 'configuracion_balance',
               'subscriptions', 'audit_logs'
             )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- 7) Core RBAC table policies
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY permissions_read ON public.permissions
FOR SELECT
USING (auth.role() = 'authenticated');

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY roles_read ON public.roles
FOR SELECT
USING (
  is_system = true
  OR owner_id = public.get_current_business_id()
);

CREATE POLICY roles_manage ON public.roles
FOR ALL
USING (
  owner_id = public.get_current_business_id()
  AND public.has_permission_secure(owner_id, 'team.manage')
  AND is_system = false
)
WITH CHECK (
  owner_id = public.get_current_business_id()
  AND public.has_permission_secure(owner_id, 'team.manage')
  AND is_system = false
);

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY role_permissions_read ON public.role_permissions
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.roles r
    WHERE r.id = role_permissions.role_id
      AND (r.is_system = true OR r.owner_id = public.get_current_business_id())
  )
);

CREATE POLICY role_permissions_manage ON public.role_permissions
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.roles r
    WHERE r.id = role_permissions.role_id
      AND r.is_system = false
      AND r.owner_id = public.get_current_business_id()
      AND public.has_permission_secure(r.owner_id, 'team.manage')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.roles r
    WHERE r.id = role_permissions.role_id
      AND r.is_system = false
      AND r.owner_id = public.get_current_business_id()
      AND public.has_permission_secure(r.owner_id, 'team.manage')
  )
);

-- 8) Team members policies (premium gated)
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY team_members_read_own ON public.team_members
FOR SELECT
USING (auth.uid() = member_id);

CREATE POLICY team_members_read_colleagues ON public.team_members
FOR SELECT
USING (public.is_member_of_team(owner_id) OR auth.uid() = owner_id);

CREATE POLICY team_members_manage ON public.team_members
FOR ALL
USING (
  public.is_premium(owner_id)
  AND public.has_permission_secure(owner_id, 'team.manage')
)
WITH CHECK (
  public.is_premium(owner_id)
  AND public.has_permission_secure(owner_id, 'team.manage')
);

-- 9) Subscriptions: owner + team can view; only owner can mutate
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY subscriptions_read ON public.subscriptions
FOR SELECT
USING (
  auth.uid() = user_id
  OR public.is_member_of_team(user_id)
);

CREATE POLICY subscriptions_manage_owner_only ON public.subscriptions
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 10) Business data enforcement (by permission)
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY transactions_read ON public.transactions
FOR SELECT
USING (public.has_permission_secure(user_id, 'finanzas.view'));

CREATE POLICY transactions_insert ON public.transactions
FOR INSERT
WITH CHECK (
  user_id = public.get_current_business_id()
  AND public.has_permission_secure(user_id, 'finanzas.create')
);

CREATE POLICY transactions_update ON public.transactions
FOR UPDATE
USING (public.has_permission_secure(user_id, 'finanzas.edit'))
WITH CHECK (public.has_permission_secure(user_id, 'finanzas.edit'));

CREATE POLICY transactions_delete ON public.transactions
FOR DELETE
USING (public.has_permission_secure(user_id, 'finanzas.delete'));

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY products_read ON public.products
FOR SELECT
USING (public.has_permission_secure(user_id, 'warehouse.view'));

CREATE POLICY products_insert ON public.products
FOR INSERT
WITH CHECK (
  user_id = public.get_current_business_id()
  AND public.has_permission_secure(user_id, 'warehouse.create')
);

CREATE POLICY products_update ON public.products
FOR UPDATE
USING (public.has_permission_secure(user_id, 'warehouse.edit'))
WITH CHECK (public.has_permission_secure(user_id, 'warehouse.edit'));

CREATE POLICY products_delete ON public.products
FOR DELETE
USING (public.has_permission_secure(user_id, 'warehouse.delete'));

ALTER TABLE public.movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY movements_read ON public.movements
FOR SELECT
USING (public.has_permission_secure(user_id, 'warehouse.view'));

CREATE POLICY movements_insert ON public.movements
FOR INSERT
WITH CHECK (
  user_id = public.get_current_business_id()
  AND public.has_permission_secure(user_id, 'warehouse.move')
);

CREATE POLICY movements_update ON public.movements
FOR UPDATE
USING (public.has_permission_secure(user_id, 'warehouse.move'))
WITH CHECK (public.has_permission_secure(user_id, 'warehouse.move'));

CREATE POLICY movements_delete ON public.movements
FOR DELETE
USING (public.has_permission_secure(user_id, 'warehouse.move'));

-- Inventory (dynamic)
ALTER TABLE public.inventory_areas ENABLE ROW LEVEL SECURITY;
CREATE POLICY inventory_areas_read ON public.inventory_areas
FOR SELECT
USING (public.has_permission_secure(user_id, 'inventory.view'));

CREATE POLICY inventory_areas_insert ON public.inventory_areas
FOR INSERT
WITH CHECK (
  user_id = public.get_current_business_id()
  AND public.has_permission_secure(user_id, 'inventory.create')
);

CREATE POLICY inventory_areas_update ON public.inventory_areas
FOR UPDATE
USING (public.has_permission_secure(user_id, 'inventory.edit'))
WITH CHECK (public.has_permission_secure(user_id, 'inventory.edit'));

CREATE POLICY inventory_areas_delete ON public.inventory_areas
FOR DELETE
USING (public.has_permission_secure(user_id, 'inventory.delete'));

ALTER TABLE public.inventory_area_fields ENABLE ROW LEVEL SECURITY;
CREATE POLICY inventory_area_fields_read ON public.inventory_area_fields
FOR SELECT
USING (public.has_permission_secure(user_id, 'inventory.view'));

CREATE POLICY inventory_area_fields_write ON public.inventory_area_fields
FOR ALL
USING (public.has_permission_secure(user_id, 'inventory.edit'))
WITH CHECK (
  user_id = public.get_current_business_id()
  AND public.has_permission_secure(user_id, 'inventory.edit')
);

ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY inventory_items_read ON public.inventory_items
FOR SELECT
USING (public.has_permission_secure(user_id, 'inventory.view'));

CREATE POLICY inventory_items_write ON public.inventory_items
FOR ALL
USING (public.has_permission_secure(user_id, 'inventory.move'))
WITH CHECK (
  user_id = public.get_current_business_id()
  AND public.has_permission_secure(user_id, 'inventory.move')
);

ALTER TABLE public.inventory_area_prefixes ENABLE ROW LEVEL SECURITY;
CREATE POLICY inventory_area_prefixes_read ON public.inventory_area_prefixes
FOR SELECT
USING (public.has_permission_secure(user_id, 'inventory.view'));

CREATE POLICY inventory_area_prefixes_write ON public.inventory_area_prefixes
FOR ALL
USING (public.has_permission_secure(user_id, 'inventory.edit'))
WITH CHECK (
  user_id = public.get_current_business_id()
  AND public.has_permission_secure(user_id, 'inventory.edit')
);

-- Config & currencies
ALTER TABLE public.business_currencies ENABLE ROW LEVEL SECURITY;
CREATE POLICY business_currencies_read ON public.business_currencies
FOR SELECT
USING (public.has_permission_secure(user_id, 'config.view'));

CREATE POLICY business_currencies_write ON public.business_currencies
FOR ALL
USING (public.has_permission_secure(user_id, 'config.edit'))
WITH CHECK (
  user_id = public.get_current_business_id()
  AND public.has_permission_secure(user_id, 'config.edit')
);

ALTER TABLE public.business_balances ENABLE ROW LEVEL SECURITY;
CREATE POLICY business_balances_read ON public.business_balances
FOR SELECT
USING (public.has_permission_secure(user_id, 'config.view'));

CREATE POLICY business_balances_write ON public.business_balances
FOR ALL
USING (public.has_permission_secure(user_id, 'config.edit'))
WITH CHECK (
  user_id = public.get_current_business_id()
  AND public.has_permission_secure(user_id, 'config.edit')
);

ALTER TABLE public.configuracion_balance ENABLE ROW LEVEL SECURITY;
CREATE POLICY configuracion_balance_read ON public.configuracion_balance
FOR SELECT
USING (public.has_permission_secure(user_id, 'config.view'));

CREATE POLICY configuracion_balance_write ON public.configuracion_balance
FOR ALL
USING (public.has_permission_secure(user_id, 'config.edit'))
WITH CHECK (
  user_id = public.get_current_business_id()
  AND public.has_permission_secure(user_id, 'config.edit')
);

-- 11) Audit logs: add business_id + actor_id to support team-wide audit and enforce view permission
ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS business_id uuid,
  ADD COLUMN IF NOT EXISTS actor_id uuid;

UPDATE public.audit_logs
SET business_id = COALESCE(business_id, user_id),
    actor_id = COALESCE(actor_id, user_id)
WHERE business_id IS NULL OR actor_id IS NULL;

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY audit_logs_read ON public.audit_logs
FOR SELECT
USING (public.has_permission_secure(business_id, 'logs.view'));

CREATE POLICY audit_logs_insert ON public.audit_logs
FOR INSERT
WITH CHECK (
  business_id = public.get_current_business_id()
  AND actor_id = auth.uid()
);

CREATE POLICY audit_logs_no_update_delete ON public.audit_logs
FOR UPDATE
USING (false);

CREATE POLICY audit_logs_no_delete ON public.audit_logs
FOR DELETE
USING (false);

