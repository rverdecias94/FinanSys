-- C2c (offline outbox): client_uuid en inventory_items + RPC create idempotente.

ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS client_uuid uuid;

CREATE UNIQUE INDEX IF NOT EXISTS inventory_items_user_client_uuid_uidx
  ON public.inventory_items (user_id, client_uuid)
  WHERE client_uuid IS NOT NULL;

COMMENT ON COLUMN public.inventory_items.client_uuid IS
  'Huella de idempotencia del cliente (outbox offline). UNIQUE por negocio cuando no es NULL.';

-- Firma anterior (3 args) → nueva con p_client_uuid opcional (retrocompatible).
DROP FUNCTION IF EXISTS public.create_inventory_item(uuid, bigint, jsonb);

CREATE OR REPLACE FUNCTION public.create_inventory_item(
  p_user uuid,
  p_area bigint,
  p_values jsonb,
  p_client_uuid uuid DEFAULT NULL
)
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

  -- Idempotencia outbox: mismo client_uuid → devolver fila existente (sin nuevo SKU).
  IF p_client_uuid IS NOT NULL THEN
    SELECT * INTO v_item
    FROM public.inventory_items
    WHERE user_id = v_business AND client_uuid = p_client_uuid;
    IF FOUND THEN
      RETURN v_item;
    END IF;
  END IF;

  v_sku := public.generate_inventory_sku(v_business, p_area);

  BEGIN
    INSERT INTO public.inventory_items (user_id, area_id, values, sku, client_uuid)
    VALUES (v_business, p_area, p_values, v_sku, p_client_uuid)
    RETURNING * INTO v_item;
  EXCEPTION
    WHEN unique_violation THEN
      IF p_client_uuid IS NOT NULL THEN
        SELECT * INTO v_item
        FROM public.inventory_items
        WHERE user_id = v_business AND client_uuid = p_client_uuid;
        IF FOUND THEN
          RETURN v_item;
        END IF;
      END IF;
      RAISE;
  END;

  RETURN v_item;
END;
$$;

REVOKE ALL ON FUNCTION public.create_inventory_item(uuid, bigint, jsonb, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.create_inventory_item(uuid, bigint, jsonb, uuid) TO authenticated;
