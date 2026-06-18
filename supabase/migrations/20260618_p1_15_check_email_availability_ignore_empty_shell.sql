-- P1.15 — Miembro eliminado del equipo que vuelve a iniciar sesión se volvía
-- "dueño" de un cascarón vacío y dejaba de poder reinvitarse.
--
-- Causa raíz: `check_email_availability` consideraba "dueño" (email NO disponible)
-- a cualquier usuario con filas en inventory_areas. Pero las áreas/monedas son
-- ANDAMIAJE de configuración (vacío) — un miembro removido con sólo ese cascarón
-- debe poder reinvitarse. Un miembro NO acumula datos propios (opera bajo el
-- user_id del dueño vía getEffectiveUserId), así que sólo bloqueamos si hay
-- CONTENIDO real: productos, transacciones o movimientos.
--
-- Cambio: el EXISTS de `is_owner` ya NO mira inventory_areas.
-- Complemento client-side: services/team.js `inviteMember` hace upsert sobre la
-- UNIQUE(owner_id, member_email) para reactivar filas 'revoked' al reinvitar.
--
-- Rollback: restaurar el UNION ALL `inventory_areas` en el EXISTS de is_owner.

CREATE OR REPLACE FUNCTION public.check_email_availability(email_input text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  target_user_id UUID;
  is_owner BOOLEAN;
  is_member BOOLEAN;
BEGIN
  SELECT id INTO target_user_id
  FROM auth.users
  WHERE email = email_input;

  IF target_user_id IS NOT NULL THEN
    -- "Dueño" = tiene CONTENIDO real (no sólo andamiaje vacío de áreas/monedas).
    SELECT EXISTS(
      SELECT 1 FROM public.products WHERE user_id = target_user_id
      UNION ALL
      SELECT 1 FROM public.transactions WHERE user_id = target_user_id
      UNION ALL
      SELECT 1 FROM public.movements WHERE user_id = target_user_id
      LIMIT 1
    ) INTO is_owner;

    SELECT EXISTS(
      SELECT 1 FROM public.team_members
      WHERE (member_email = email_input OR member_id = target_user_id)
      AND status IN ('pending', 'active')
    ) INTO is_member;

    RETURN NOT (is_owner OR is_member);
  ELSE
    RETURN NOT EXISTS(
      SELECT 1 FROM public.team_members
      WHERE member_email = email_input
      AND status IN ('pending', 'active')
    );
  END IF;
END;
$function$;
