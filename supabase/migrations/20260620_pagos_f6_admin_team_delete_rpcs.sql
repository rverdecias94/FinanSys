-- ============================================================================
-- PAGOS PREMIUM · FASE 6 — Admin: subcuentas de equipo (global) +
-- suspender/reactivar + ELIMINAR usuarios (borrado permanente real).
-- (docs/PLAN_PAGOS_PREMIUM.md · Fase 6). Aplicado vía apply_migration.
--
--  1) admin_list_team_members(business_id default null, search, status, page, size)
--     -> subcuentas de equipo (email, rol, membership_status, account_status,
--        negocio/owner email). business_id NULL = todas; si no, las de ese negocio.
--  2) admin_set_account_status(target_user_id, status, reason) -> upsert en
--     account_status (active|suspended|deleted) + updated_by + auditoría.
--     No permite cambiarse a sí mismo ni a otro system_admin. Integra con
--     AccountGate (Fase 3): suspendido -> el usuario ve el modal de cuenta inhabilitada.
--  3) admin_preview_user_deletion(target_user_id) -> conteos por tabla del impacto
--     ANTES de borrar (para la doble confirmación de la UI).
--  4) admin_delete_user(target_user_id) -> BORRADO PERMANENTE. Borra en cascada
--     explícita TODAS las filas con user_id/owner_id/business_id/member_id = target
--     en cada tabla de public (hijos antes que padres), limpia referencias
--     "by/actor" de otros negocios (FKs NO ACTION) y por último el usuario de
--     auth.users. Audita ANTES de borrar (registro bajo el admin, sobrevive).
--
-- Todas SECURITY DEFINER, gated is_system_admin(); EXECUTE solo authenticated;
-- REVOKE anon/public. Idempotente (CREATE OR REPLACE).
-- ============================================================================

-- 1) Listado global de subcuentas de equipo ----------------------------------
CREATE OR REPLACE FUNCTION public.admin_list_team_members(
  p_business_id uuid DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_status text DEFAULT NULL,        -- filtro por account_status: active|suspended|deleted|all
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 10
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
DECLARE
  v_from integer;
  v_size integer;
  v_result json;
BEGIN
  IF NOT public.is_system_admin() THEN
    RAISE EXCEPTION 'Solo un administrador del sistema' USING ERRCODE = 'P0001';
  END IF;
  v_size := COALESCE(p_page_size, 10);
  v_from := GREATEST(0, (COALESCE(p_page, 1) - 1) * v_size);

  WITH base AS (
    SELECT tm.id AS team_member_id,
           tm.member_id,
           tm.member_email,
           tm.owner_id AS business_id,
           ou.email AS owner_email,
           COALESCE(r.name, tm.role_legacy) AS role,
           tm.status AS membership_status,
           COALESCE(acc.status, 'active') AS account_status,
           tm.created_at
    FROM public.team_members tm
    LEFT JOIN public.roles r ON r.id = tm.role_id
    LEFT JOIN auth.users ou ON ou.id = tm.owner_id
    LEFT JOIN public.account_status acc ON acc.user_id = tm.member_id
    WHERE (p_business_id IS NULL OR tm.owner_id = p_business_id)
  ),
  filtered AS (
    SELECT * FROM base
    WHERE (p_search IS NULL OR p_search = ''
           OR member_email ILIKE '%' || p_search || '%'
           OR owner_email ILIKE '%' || p_search || '%')
      AND (p_status IS NULL OR p_status = 'all' OR account_status = p_status)
  )
  SELECT json_build_object(
    'rows', COALESCE((SELECT json_agg(pg) FROM (
       SELECT * FROM filtered ORDER BY created_at DESC OFFSET v_from LIMIT v_size) pg), '[]'::json),
    'total', (SELECT count(*) FROM filtered)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_team_members(uuid, text, text, integer, integer) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_team_members(uuid, text, text, integer, integer) TO authenticated;

-- 2) Suspender / reactivar (estado de cuenta) --------------------------------
CREATE OR REPLACE FUNCTION public.admin_set_account_status(
  p_target_user_id uuid,
  p_status text,
  p_reason text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
DECLARE
  v_admin_email text;
  v_target_email text;
BEGIN
  IF NOT public.is_system_admin() THEN
    RAISE EXCEPTION 'Solo un administrador del sistema' USING ERRCODE = 'P0001';
  END IF;
  IF p_target_user_id IS NULL THEN
    RAISE EXCEPTION 'target_user_id requerido' USING ERRCODE = 'P0001';
  END IF;
  IF p_status NOT IN ('active', 'suspended', 'deleted') THEN
    RAISE EXCEPTION 'Estado inválido (active|suspended|deleted)' USING ERRCODE = 'P0001';
  END IF;
  IF p_target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'No puedes cambiar el estado de tu propia cuenta' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (SELECT 1 FROM public.system_admins WHERE user_id = p_target_user_id) THEN
    RAISE EXCEPTION 'No puedes suspender ni eliminar a otro administrador del sistema' USING ERRCODE = 'P0001';
  END IF;

  SELECT email INTO v_target_email FROM auth.users WHERE id = p_target_user_id;
  IF v_target_email IS NULL THEN
    RAISE EXCEPTION 'Usuario no encontrado' USING ERRCODE = 'P0001';
  END IF;
  v_admin_email := public.get_current_user_email();

  INSERT INTO public.account_status (user_id, status, reason, updated_by, updated_at)
  VALUES (p_target_user_id, p_status, NULLIF(p_reason, ''), auth.uid(), now())
  ON CONFLICT (user_id) DO UPDATE
    SET status = EXCLUDED.status,
        reason = EXCLUDED.reason,
        updated_by = EXCLUDED.updated_by,
        updated_at = now();

  INSERT INTO public.audit_logs (business_id, actor_id, user_id, user_email, action, resource, details, area)
  VALUES (p_target_user_id, auth.uid(), auth.uid(), v_admin_email,
          CASE p_status
            WHEN 'suspended' THEN 'Suspender Cuenta'
            WHEN 'active' THEN 'Reactivar Cuenta'
            ELSE 'Marcar Cuenta Eliminada'
          END,
          'Cuenta',
          jsonb_build_object('target_user_id', p_target_user_id, 'target_email', v_target_email,
                             'status', p_status, 'reason', NULLIF(p_reason, '')),
          'Usuarios');

  RETURN json_build_object('target_user_id', p_target_user_id, 'status', p_status, 'email', v_target_email);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_account_status(uuid, text, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_account_status(uuid, text, text) TO authenticated;

-- 3) Previsualización del impacto de borrado ---------------------------------
CREATE OR REPLACE FUNCTION public.admin_preview_user_deletion(p_target_user_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
DECLARE
  v_email text;
  v_counts json;
  v_total bigint;
BEGIN
  IF NOT public.is_system_admin() THEN
    RAISE EXCEPTION 'Solo un administrador del sistema' USING ERRCODE = 'P0001';
  END IF;
  IF p_target_user_id IS NULL THEN
    RAISE EXCEPTION 'target_user_id requerido' USING ERRCODE = 'P0001';
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = p_target_user_id;

  SELECT json_build_object(
    'transactions',            (SELECT count(*) FROM public.transactions WHERE user_id = p_target_user_id),
    'products',                (SELECT count(*) FROM public.products WHERE user_id = p_target_user_id),
    'movements',               (SELECT count(*) FROM public.movements WHERE user_id = p_target_user_id),
    'inventory_areas',         (SELECT count(*) FROM public.inventory_areas WHERE user_id = p_target_user_id),
    'inventory_items',         (SELECT count(*) FROM public.inventory_items WHERE user_id = p_target_user_id),
    'inventory_area_fields',   (SELECT count(*) FROM public.inventory_area_fields WHERE user_id = p_target_user_id),
    'inventory_area_prefixes', (SELECT count(*) FROM public.inventory_area_prefixes WHERE user_id = p_target_user_id),
    'business_currencies',     (SELECT count(*) FROM public.business_currencies WHERE user_id = p_target_user_id),
    'business_balances',       (SELECT count(*) FROM public.business_balances WHERE user_id = p_target_user_id),
    'configuracion_balance',   (SELECT count(*) FROM public.configuracion_balance WHERE user_id = p_target_user_id),
    'business_settings',       (SELECT count(*) FROM public.business_settings WHERE user_id = p_target_user_id),
    'contacts',                (SELECT count(*) FROM public.contacts WHERE user_id = p_target_user_id),
    'exchange_rates',          (SELECT count(*) FROM public.exchange_rates WHERE user_id = p_target_user_id),
    'usage_metrics',           (SELECT count(*) FROM public.usage_metrics WHERE user_id = p_target_user_id),
    'payments',                (SELECT count(*) FROM public.payments WHERE business_id = p_target_user_id),
    'plan_change_requests',    (SELECT count(*) FROM public.plan_change_requests WHERE business_id = p_target_user_id),
    'roles',                   (SELECT count(*) FROM public.roles WHERE owner_id = p_target_user_id),
    'team_members_as_owner',   (SELECT count(*) FROM public.team_members WHERE owner_id = p_target_user_id),
    'team_members_as_member',  (SELECT count(*) FROM public.team_members WHERE member_id = p_target_user_id),
    'subscriptions',           (SELECT count(*) FROM public.subscriptions WHERE user_id = p_target_user_id),
    'audit_logs',              (SELECT count(*) FROM public.audit_logs WHERE business_id = p_target_user_id OR user_id = p_target_user_id),
    'account_status',          (SELECT count(*) FROM public.account_status WHERE user_id = p_target_user_id)
  ) INTO v_counts;

  SELECT COALESCE(SUM(value::bigint), 0) INTO v_total FROM json_each_text(v_counts);

  RETURN json_build_object(
    'target_user_id', p_target_user_id,
    'email', v_email,
    'is_system_admin', EXISTS (SELECT 1 FROM public.system_admins WHERE user_id = p_target_user_id),
    'is_owner',  EXISTS (SELECT 1 FROM public.subscriptions WHERE user_id = p_target_user_id),
    'is_member', EXISTS (SELECT 1 FROM public.team_members WHERE member_id = p_target_user_id),
    'counts', v_counts,
    'total_rows', v_total
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_preview_user_deletion(uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_preview_user_deletion(uuid) TO authenticated;

-- 4) Borrado permanente real -------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_delete_user(p_target_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
DECLARE
  v_admin_email text;
  v_target_email text;
  v_preview json;
BEGIN
  IF NOT public.is_system_admin() THEN
    RAISE EXCEPTION 'Solo un administrador del sistema' USING ERRCODE = 'P0001';
  END IF;
  IF p_target_user_id IS NULL THEN
    RAISE EXCEPTION 'target_user_id requerido' USING ERRCODE = 'P0001';
  END IF;
  IF p_target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'No puedes eliminar tu propia cuenta' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (SELECT 1 FROM public.system_admins WHERE user_id = p_target_user_id) THEN
    RAISE EXCEPTION 'Desmarca al usuario como administrador del sistema antes de eliminarlo' USING ERRCODE = 'P0001';
  END IF;

  SELECT email INTO v_target_email FROM auth.users WHERE id = p_target_user_id;
  IF v_target_email IS NULL THEN
    RAISE EXCEPTION 'Usuario no encontrado' USING ERRCODE = 'P0001';
  END IF;
  v_admin_email := public.get_current_user_email();
  v_preview := public.admin_preview_user_deletion(p_target_user_id);

  -- Auditoría ANTES de borrar. Se registra bajo el admin (business_id/user_id =
  -- auth.uid()) para que NO sea alcanzada por el borrado de filas del target.
  INSERT INTO public.audit_logs (business_id, actor_id, user_id, user_email, action, resource, details, area)
  VALUES (auth.uid(), auth.uid(), auth.uid(), v_admin_email,
          'Eliminar Usuario (permanente)', 'Cuenta',
          jsonb_build_object('target_user_id', p_target_user_id, 'target_email', v_target_email, 'impact', v_preview),
          'Usuarios');

  -- ----- Borrado en cascada explícito (hijos -> padres) -----
  DELETE FROM public.movements               WHERE user_id = p_target_user_id;
  DELETE FROM public.inventory_items         WHERE user_id = p_target_user_id;
  DELETE FROM public.inventory_area_fields   WHERE user_id = p_target_user_id;
  DELETE FROM public.inventory_area_prefixes WHERE user_id = p_target_user_id;
  DELETE FROM public.inventory_areas         WHERE user_id = p_target_user_id;
  DELETE FROM public.products                WHERE user_id = p_target_user_id;
  DELETE FROM public.transactions            WHERE user_id = p_target_user_id;
  DELETE FROM public.contacts                WHERE user_id = p_target_user_id;
  DELETE FROM public.exchange_rates          WHERE user_id = p_target_user_id;
  DELETE FROM public.business_currencies     WHERE user_id = p_target_user_id;
  DELETE FROM public.business_balances       WHERE user_id = p_target_user_id;
  DELETE FROM public.configuracion_balance   WHERE user_id = p_target_user_id;
  DELETE FROM public.business_settings       WHERE user_id = p_target_user_id;
  DELETE FROM public.usage_metrics           WHERE user_id = p_target_user_id;
  DELETE FROM public.payments                WHERE business_id = p_target_user_id;
  DELETE FROM public.plan_change_requests    WHERE business_id = p_target_user_id;
  -- team_members antes que roles (team_members.role_id -> roles es NO ACTION).
  DELETE FROM public.team_members            WHERE owner_id = p_target_user_id OR member_id = p_target_user_id;
  DELETE FROM public.roles                   WHERE owner_id = p_target_user_id;  -- cascada role_permissions
  DELETE FROM public.subscriptions           WHERE user_id = p_target_user_id;
  DELETE FROM public.system_admins           WHERE user_id = p_target_user_id;  -- defensivo (ya validado)
  DELETE FROM public.account_status          WHERE user_id = p_target_user_id;
  DELETE FROM public.audit_logs              WHERE business_id = p_target_user_id OR user_id = p_target_user_id;

  -- Anular referencias "by/actor" de OTROS negocios (FKs NO ACTION) para no
  -- bloquear el borrado del usuario de auth.users.
  UPDATE public.payments             SET recorded_by = NULL WHERE recorded_by = p_target_user_id;
  UPDATE public.plan_change_requests SET reviewed_by = NULL WHERE reviewed_by = p_target_user_id;
  UPDATE public.subscriptions        SET approved_by = NULL WHERE approved_by = p_target_user_id;
  UPDATE public.subscriptions        SET cancelled_by = NULL WHERE cancelled_by = p_target_user_id;
  UPDATE public.account_status       SET updated_by = NULL WHERE updated_by = p_target_user_id;
  UPDATE public.audit_logs           SET actor_id = NULL WHERE actor_id = p_target_user_id;  -- sin FK; limpieza

  -- Finalmente, el usuario de auth (cascada de auth.identities/sessions/etc.).
  DELETE FROM auth.users WHERE id = p_target_user_id;

  RETURN json_build_object('deleted', true, 'target_user_id', p_target_user_id,
                           'email', v_target_email, 'impact', v_preview);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_user(uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_user(uuid) TO authenticated;

-- 5) Extender Fase 5: incluir el account_status del dueño en el listado y el
--    detalle de negocios (para elegir Suspender vs Reactivar en la pestaña Negocios).
CREATE OR REPLACE FUNCTION public.admin_list_businesses(
  p_search text DEFAULT NULL,
  p_plan text DEFAULT NULL,
  p_payment_state text DEFAULT NULL,
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 10
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
DECLARE
  v_from integer;
  v_size integer;
  v_result json;
BEGIN
  IF NOT public.is_system_admin() THEN
    RAISE EXCEPTION 'Solo un administrador del sistema' USING ERRCODE = 'P0001';
  END IF;
  v_size := COALESCE(p_page_size, 10);
  v_from := GREATEST(0, (COALESCE(p_page, 1) - 1) * v_size);

  WITH base AS (
    SELECT s.user_id AS business_id, u.email AS email, s.plan_id, s.status, s.billing_cycle,
           s.current_period_end,
           public.get_payment_state(s.plan_id, s.status, s.current_period_end) AS payment_state,
           COALESCE((SELECT acc.status FROM public.account_status acc WHERE acc.user_id = s.user_id), 'active') AS account_status,
           (SELECT count(*) FROM public.team_members tm WHERE tm.owner_id = s.user_id AND tm.status = 'active') AS members,
           (SELECT row_to_json(p) FROM (
              SELECT amount, paid_at, billing_cycle FROM public.payments pp
              WHERE pp.business_id = s.user_id ORDER BY paid_at DESC LIMIT 1) p) AS last_payment,
           s.created_at
    FROM public.subscriptions s
    LEFT JOIN auth.users u ON u.id = s.user_id
    WHERE NOT EXISTS (SELECT 1 FROM public.team_members m WHERE m.member_id = s.user_id AND m.status = 'active')
  ),
  filtered AS (
    SELECT * FROM base
    WHERE (p_search IS NULL OR p_search = '' OR email ILIKE '%' || p_search || '%' OR business_id::text ILIKE '%' || p_search || '%')
      AND (p_plan IS NULL OR p_plan = 'all' OR plan_id = p_plan)
      AND (p_payment_state IS NULL OR p_payment_state = 'all' OR payment_state = p_payment_state)
  )
  SELECT json_build_object(
    'rows', COALESCE((SELECT json_agg(pg) FROM (SELECT * FROM filtered ORDER BY created_at DESC OFFSET v_from LIMIT v_size) pg), '[]'::json),
    'total', (SELECT count(*) FROM filtered)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_businesses(text, text, text, integer, integer) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_businesses(text, text, text, integer, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_get_business_detail(p_business_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
BEGIN
  IF NOT public.is_system_admin() THEN
    RAISE EXCEPTION 'Solo un administrador del sistema' USING ERRCODE = 'P0001';
  END IF;
  IF p_business_id IS NULL THEN
    RAISE EXCEPTION 'business_id requerido' USING ERRCODE = 'P0001';
  END IF;

  RETURN json_build_object(
    'business_id', p_business_id,
    'email', (SELECT email FROM auth.users WHERE id = p_business_id),
    'account_status', COALESCE((SELECT status FROM public.account_status WHERE user_id = p_business_id), 'active'),
    'subscription', (SELECT row_to_json(s) FROM (
        SELECT plan_id, status, billing_cycle, current_period_start, current_period_end,
               source, approved_at, cancelled_at, admin_notes
        FROM public.subscriptions WHERE user_id = p_business_id) s),
    'payment_state', (SELECT public.get_payment_state(plan_id, status, current_period_end)
                      FROM public.subscriptions WHERE user_id = p_business_id),
    'payments', (SELECT COALESCE(json_agg(p), '[]'::json) FROM (
        SELECT id, amount, currency_code, billing_cycle, period_start, period_end, paid_at,
               method, reference, status, notes
        FROM public.payments WHERE business_id = p_business_id ORDER BY paid_at DESC) p),
    'members', (SELECT COALESCE(json_agg(m), '[]'::json) FROM (
        SELECT tm.member_email, tm.member_id, tm.status, r.name AS role,
               COALESCE((SELECT status FROM public.account_status WHERE user_id = tm.member_id), 'active') AS account_status
        FROM public.team_members tm LEFT JOIN public.roles r ON r.id = tm.role_id
        WHERE tm.owner_id = p_business_id ORDER BY tm.created_at ASC) m),
    'requests', (SELECT COALESCE(json_agg(q), '[]'::json) FROM (
        SELECT id, requested_plan_id, billing_cycle, requested_amount, status, created_at
        FROM public.plan_change_requests WHERE business_id = p_business_id
        ORDER BY created_at DESC LIMIT 10) q)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_business_detail(uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_business_detail(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- ROLLBACK (manual):
--   DROP FUNCTION IF EXISTS public.admin_delete_user(uuid);
--   DROP FUNCTION IF EXISTS public.admin_preview_user_deletion(uuid);
--   DROP FUNCTION IF EXISTS public.admin_set_account_status(uuid, text, text);
--   DROP FUNCTION IF EXISTS public.admin_list_team_members(uuid, text, text, integer, integer);
-- ============================================================================
