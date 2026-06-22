-- ============================================================================
-- FIX · owner_delete_team_member: clasificación de "cuenta independiente"
--
-- Problema: el guard trataba como "independiente" (y por tanto NO borraba la
-- cuenta auth) a CUALQUIER miembro con una fila en `subscriptions`. La regresión
-- corregida en 94dafc3 creó suscripciones free a los miembros, así que al
-- borrarlos se conservaba su auth y volvían a entrar como titular free.
--
-- Corrección: "independiente" = tiene CONTENIDO REAL (transactions/products/
-- movements) O posee su propio equipo O es miembro activo de OTRO negocio.
-- Una suscripción free residual (sin contenido) NO cuenta. Alineado con la
-- definición de "dueño real" de check_email_availability.
--
-- Resultado: un miembro "puro" (solo cascarón + sub residual) se elimina por
-- completo (auth incluida) y, al reintentar entrar, recibe "credenciales
-- inválidas". Los registros de auditoría se conservan (no se tocan audit_logs).
--
-- CREATE OR REPLACE: no destructivo (solo cambia la lógica del guard).
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
  --    "Independiente" = tiene CONTENIDO REAL propio, posee su propio equipo, o
  --    es miembro activo de OTRO negocio. Una suscripción free RESIDUAL (sin
  --    contenido) NO cuenta: era el residuo de la regresión y hacía que los
  --    miembros "puros" no se eliminaran (volvían a entrar como titular free).
  v_is_independent := (
       EXISTS (SELECT 1 FROM public.transactions   WHERE user_id  = v_member_id)
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

  -- Limpieza del "cascarón" del miembro (incluye la suscripción free residual).
  -- NO se tocan los audit_logs (se conservan por decisión).
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
  DELETE FROM public.subscriptions           WHERE user_id = v_member_id;
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

NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- ROLLBACK: re-aplicar 20260621_owner_delete_team_member.sql (versión anterior).
-- ============================================================================
