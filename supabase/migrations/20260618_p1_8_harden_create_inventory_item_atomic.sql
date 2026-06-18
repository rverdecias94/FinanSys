-- P1.8 (Sesión 4, 2026-06-18) — APLICADO Y VERIFICADO en producción
-- (remoto: p1_8_harden_create_inventory_item_atomic).
-- SKU no atómico: createItem (dynamicInventory.js) llamaba generate_inventory_sku (avanza la secuencia)
-- y LUEGO hacía un INSERT separado -> si el INSERT fallaba, quedaba un hueco de SKU.
-- Existía create_inventory_item (SKU+INSERT atómico) pero era SECURITY DEFINER SIN chequeo de permiso:
-- usarla tal cual haría bypass de la RLS (rompería el control de P1.4). Esta versión endurecida:
--   * resuelve el negocio server-side (get_current_business_id) y rechaza p_user ajeno
--   * exige inventory.create (alineado con P1.4)
--   * usa generate_inventory_sku DENTRO de la misma transacción -> si el INSERT falla, rollback (sin hueco)
-- El cliente (dynamicInventory.js createItem) pasa a llamar a esta RPC.
-- Verificado (REST miembro con inventory.create): 2 creaciones -> ELEC-0005, ELEC-0006 (SKU contiguo);
--   p_user ajeno -> 403 "No autorizado: el item no pertenece a tu negocio".
--   Localhost (owner): crear ítem por UI -> sku ELEC-0005, next_seq avanza, sin errores de consola.
-- Rollback: restaurar la versión previa de create_inventory_item (ver 20260209_inventory_sku.sql) y
--   revertir dynamicInventory.js a generate_inventory_sku + INSERT separado.

CREATE OR REPLACE FUNCTION public.create_inventory_item(p_user uuid, p_area bigint, p_values jsonb)
RETURNS inventory_items
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_business uuid := public.get_current_business_id();
  v_sku text;
  v_item inventory_items;
BEGIN
  IF p_area IS NULL THEN
    RAISE EXCEPTION 'area_id es requerido' USING ERRCODE = '22023';
  END IF;

  IF p_user IS DISTINCT FROM v_business THEN
    RAISE EXCEPTION 'No autorizado: el item no pertenece a tu negocio' USING ERRCODE = '42501';
  END IF;
  IF NOT public.has_permission_secure(v_business, 'inventory.create') THEN
    RAISE EXCEPTION 'No autorizado: requiere permiso inventory.create' USING ERRCODE = '42501';
  END IF;

  v_sku := public.generate_inventory_sku(v_business, p_area);

  INSERT INTO public.inventory_items (user_id, area_id, values, sku)
  VALUES (v_business, p_area, p_values, v_sku)
  RETURNING * INTO v_item;

  RETURN v_item;
END;
$$;

REVOKE ALL ON FUNCTION public.create_inventory_item(uuid, bigint, jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.create_inventory_item(uuid, bigint, jsonb) TO authenticated;
