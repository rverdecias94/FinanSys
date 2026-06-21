-- ============================================================================
-- EQUIPO · Borrado total del miembro por el OWNER del negocio.
-- (Corrección flujo 1: al eliminar un miembro de equipo, su cuenta de acceso
--  debe eliminarse por completo, conservando los registros de auditoría del
--  negocio con la referencia del miembro — user_email / user_id se mantienen).
--
-- Problema corregido: removeMember() solo borraba la fila de team_members; el
-- usuario auth sobrevivía y al re-entrar get_user_business_context lo
-- auto-promovía a owner de una cuenta gratis nueva. Borrando la cuenta auth,
-- el login nativo falla = "la cuenta no existe".
--
-- Función: owner_delete_team_member(p_member_id uuid)  -- p_member_id = team_members.id
--   - Gate: solo el OWNER del negocio (owner_id = auth.uid()). Esto también
--     cubre multi-negocio: un owner solo puede tocar a SUS miembros.
--   - No permite eliminar a un system admin ni auto-eliminarse.
--   - GUARDA MULTI-NEGOCIO (seguridad): si el miembro es en realidad una cuenta
--     independiente (tiene suscripción/contenido propio, posee su propio equipo,
--     o es miembro activo de otro negocio) NO se borra auth.users; solo se quita
--     la membresía local. Devuelve deleted_auth=false en ese caso.
--   - Invitación pendiente (member_id NULL): solo se borra la fila de membresía.
--   - Audita ANTES de borrar, bajo el OWNER (business_id/actor_id = auth.uid()),
--     para que el registro sobreviva.
--   - audit_logs del miembro NO se tocan (sin FK a auth.users → el DELETE no se
--     bloquea; se conservan por decisión de negocio, con user_email/user_id).
--
-- SECURITY DEFINER (borrar auth.users requiere privilegios), search_path fijo,
-- row_security off. EXECUTE solo authenticated. Idempotente (CREATE OR REPLACE).
-- Modelada sobre admin_delete_user (20260620_pagos_f6_admin_team_delete_rpcs.sql).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.owner_delete_team_member(p_member_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
DECLARE
  v_owner_id       uuid;
  v_member_id      uuid;
  v_member_email   text;
  v_owner_email    text;
  v_is_independent boolean;
BEGIN
  -- 1) Autenticación
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado' USING ERRCODE = 'P0001';
  END IF;
  IF p_member_id IS NULL THEN
    RAISE EXCEPTION 'p_member_id requerido' USING ERRCODE = 'P0001';
  END IF;

  -- 2) Cargar la fila de membresía
  SELECT tm.owner_id, tm.member_id, tm.member_email
    INTO v_owner_id, v_member_id, v_member_email
  FROM public.team_members tm
  WHERE tm.id = p_member_id;

  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'Miembro no encontrado' USING ERRCODE = 'P0001';
  END IF;

  -- 3) Gate de owner del negocio (cubre multi-negocio)
  IF v_owner_id <> auth.uid() THEN
    RAISE EXCEPTION 'Solo el propietario del negocio puede eliminar a este miembro' USING ERRCODE = 'P0001';
  END IF;

  -- 4) No eliminar a un administrador del sistema
  IF v_member_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.system_admins WHERE user_id = v_member_id
  ) THEN
    RAISE EXCEPTION 'No puedes eliminar a un administrador del sistema' USING ERRCODE = 'P0001';
  END IF;

  -- 5) No auto-eliminarse
  IF v_member_id = auth.uid() THEN
    RAISE EXCEPTION 'No puedes eliminarte a ti mismo' USING ERRCODE = 'P0001';
  END IF;

  v_owner_email := public.get_current_user_email();

  -- ----- Caso A: invitación pendiente sin cuenta vinculada -----
  IF v_member_id IS NULL THEN
    INSERT INTO public.audit_logs (business_id, actor_id, user_id, user_email, action, resource, details, area)
    VALUES (auth.uid(), auth.uid(), auth.uid(), v_owner_email,
            'Eliminar Miembro', 'Miembro: ' || COALESCE(v_member_email, '(sin email)'),
            jsonb_build_object('member_email', v_member_email, 'member_id', NULL, 'deleted_auth', false),
            'Equipo');

    DELETE FROM public.team_members WHERE id = p_member_id;

    RETURN json_build_object('removed_membership', true, 'deleted_auth', false,
                             'reason', 'pending_invite', 'member_email', v_member_email);
  END IF;

  -- 6) GUARDA MULTI-NEGOCIO: ¿es una cuenta independiente que NO debemos destruir?
  v_is_independent := (
       EXISTS (SELECT 1 FROM public.subscriptions  WHERE user_id  = v_member_id)
    OR EXISTS (SELECT 1 FROM public.transactions   WHERE user_id  = v_member_id)
    OR EXISTS (SELECT 1 FROM public.products       WHERE user_id  = v_member_id)
    OR EXISTS (SELECT 1 FROM public.movements      WHERE user_id  = v_member_id)
    OR EXISTS (SELECT 1 FROM public.team_members   WHERE owner_id = v_member_id)
    OR EXISTS (SELECT 1 FROM public.team_members
               WHERE member_id = v_member_id AND owner_id <> v_owner_id AND status = 'active')
  );

  IF v_is_independent THEN
    -- Solo desligar del negocio actual; conservar la cuenta auth.
    INSERT INTO public.audit_logs (business_id, actor_id, user_id, user_email, action, resource, details, area)
    VALUES (auth.uid(), auth.uid(), v_member_id, v_owner_email,
            'Eliminar Miembro', 'Miembro: ' || COALESCE(v_member_email, '(sin email)'),
            jsonb_build_object('member_email', v_member_email, 'member_id', v_member_id, 'deleted_auth', false),
            'Equipo');

    DELETE FROM public.team_members WHERE id = p_member_id;

    RETURN json_build_object('removed_membership', true, 'deleted_auth', false,
                             'reason', 'independent_account', 'member_email', v_member_email);
  END IF;

  -- ----- Caso B: miembro "puro" -> eliminar la cuenta por completo -----
  -- Auditar ANTES de borrar, bajo el OWNER (sobrevive al borrado).
  INSERT INTO public.audit_logs (business_id, actor_id, user_id, user_email, action, resource, details, area)
  VALUES (auth.uid(), auth.uid(), v_member_id, v_owner_email,
          'Eliminar Miembro (cuenta)', 'Miembro: ' || COALESCE(v_member_email, '(sin email)'),
          jsonb_build_object('member_email', v_member_email, 'member_id', v_member_id, 'deleted_auth', true),
          'Equipo');

  -- Limpieza defensiva del "cascarón" del miembro (normalmente vacío: opera bajo
  -- el user_id del owner). NO se tocan los audit_logs (se conservan por decisión).
  DELETE FROM public.movements               WHERE user_id = v_member_id;
  DELETE FROM public.inventory_items         WHERE user_id = v_member_id;
  DELETE FROM public.inventory_area_fields   WHERE user_id = v_member_id;
  DELETE FROM public.inventory_area_prefixes WHERE user_id = v_member_id;
  DELETE FROM public.inventory_areas         WHERE user_id = v_member_id;
  DELETE FROM public.products                WHERE user_id = v_member_id;
  DELETE FROM public.transactions            WHERE user_id = v_member_id;
  DELETE FROM public.contacts                WHERE user_id = v_member_id;
  DELETE FROM public.exchange_rates          WHERE user_id = v_member_id;
  DELETE FROM public.business_currencies     WHERE user_id = v_member_id;
  DELETE FROM public.business_balances       WHERE user_id = v_member_id;
  DELETE FROM public.configuracion_balance   WHERE user_id = v_member_id;
  DELETE FROM public.business_settings       WHERE user_id = v_member_id;
  DELETE FROM public.usage_metrics           WHERE user_id = v_member_id;
  -- Todas sus membresías (en este negocio; la guarda excluyó otras activas).
  DELETE FROM public.team_members            WHERE member_id = v_member_id;
  DELETE FROM public.roles                   WHERE owner_id = v_member_id;  -- cascada role_permissions
  DELETE FROM public.account_status          WHERE user_id = v_member_id;

  -- Anular referencias "by/actor" en otros registros (FKs NO ACTION / sin FK)
  -- para no dejar punteros colgando. audit_logs.user_id/user_email se CONSERVAN.
  UPDATE public.account_status SET updated_by = NULL WHERE updated_by = v_member_id;

  -- Finalmente, la cuenta de acceso (cascada de auth.identities/sessions/etc.).
  DELETE FROM auth.users WHERE id = v_member_id;

  RETURN json_build_object('removed_membership', true, 'deleted_auth', true,
                           'member_email', v_member_email, 'member_id', v_member_id);
END;
$$;

REVOKE ALL ON FUNCTION public.owner_delete_team_member(uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.owner_delete_team_member(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- ROLLBACK (manual):
--   DROP FUNCTION IF EXISTS public.owner_delete_team_member(uuid);
-- ============================================================================
