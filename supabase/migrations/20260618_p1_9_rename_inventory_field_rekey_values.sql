-- P1.9 (Sesión 5, 2026-06-18) — APLICADO Y VERIFICADO en producción
-- (remoto: p1_9_rename_inventory_field_rekey_values).
-- Renombrar un campo huérfana los datos: inventory_items.values se indexa por field.name; al renombrar
-- el campo (FormBuilder.jsx), los values de los ítems quedaban con la clave vieja.
-- Esta RPC, en UNA transacción: valida inventory.edit + propiedad (negocio server-side), evita colisión
-- con otro campo del área (clobbearía datos), renombra name+label y RE-INDEXA la clave en los values de
-- todos los ítems del área. El cliente (FormBuilder handleRenameField → renameInventoryField) la llama.
-- Verificado (REST owner): rename re-indexa el ítem; colisión → 409/23505. REST miembro sin inventory.edit
-- → 403/42501. Localhost: rename por UI (campo_renombrado→campo_final) re-indexa el value sin perderlo.
-- Rollback: DROP FUNCTION public.rename_inventory_field(bigint, text); (y revertir FormBuilder al onBlur previo).
CREATE OR REPLACE FUNCTION public.rename_inventory_field(p_field_id bigint, p_new_name text)
RETURNS public.inventory_area_fields
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_business uuid := public.get_current_business_id();
  v_old_name text;
  v_area bigint;
  v_new text := btrim(p_new_name);
  v_norm text;
  v_label text;
  v_field public.inventory_area_fields;
BEGIN
  IF v_new = '' THEN
    RAISE EXCEPTION 'El nombre del campo no puede estar vacío' USING ERRCODE = '22023';
  END IF;
  IF NOT public.has_permission_secure(v_business, 'inventory.edit') THEN
    RAISE EXCEPTION 'No autorizado: requiere permiso inventory.edit' USING ERRCODE = '42501';
  END IF;

  SELECT name, area_id INTO v_old_name, v_area
  FROM public.inventory_area_fields
  WHERE id = p_field_id AND user_id = v_business
  FOR UPDATE;

  IF v_old_name IS NULL THEN
    RAISE EXCEPTION 'Campo no encontrado en el negocio' USING ERRCODE = 'P0002';
  END IF;

  IF v_old_name = v_new THEN
    SELECT * INTO v_field FROM public.inventory_area_fields WHERE id = p_field_id;
    RETURN v_field;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.inventory_area_fields
    WHERE area_id = v_area AND user_id = v_business AND id <> p_field_id AND name = v_new
  ) THEN
    RAISE EXCEPTION 'Ya existe un campo con ese nombre en esta área' USING ERRCODE = '23505';
  END IF;

  -- label = toLabelFromName(v_new): [_-]+ -> espacio, colapsar espacios, capitalizar 1ª letra
  v_norm := regexp_replace(regexp_replace(v_new, '[_-]+', ' ', 'g'), '\s+', ' ', 'g');
  v_label := upper(substring(v_norm from 1 for 1)) || substring(v_norm from 2);

  UPDATE public.inventory_area_fields
    SET name = v_new, label = v_label
    WHERE id = p_field_id AND user_id = v_business
    RETURNING * INTO v_field;

  UPDATE public.inventory_items
    SET values = (values - v_old_name) || jsonb_build_object(v_new, values -> v_old_name),
        updated_at = now()
    WHERE area_id = v_area AND user_id = v_business AND values ? v_old_name;

  RETURN v_field;
END;
$$;

REVOKE ALL ON FUNCTION public.rename_inventory_field(bigint, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.rename_inventory_field(bigint, text) TO authenticated;
