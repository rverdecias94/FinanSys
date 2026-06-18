-- P1.6 + P1.7 (Sesión 4, 2026-06-18) — APLICADO Y VERIFICADO en producción
-- (remoto: p1_6_p1_7_atomic_stock_movement).
-- P1.6: el registro de movimiento en almacen.js:192-220 hacía read-modify-write (lee stock, calcula,
--       UPDATE) -> race condition / lost update con movimientos concurrentes.
-- P1.7: products.stock no tenía CHECK ni validación servidor; el stock podía quedar negativo.
-- Fix: CHECK (stock>=0) como backstop + RPC atómica register_stock_movement que en UNA transacción
--      actualiza stock con un solo UPDATE (lock de fila, sin race), inserta el movimiento, valida el
--      permiso warehouse.move y bloquea stock negativo con mensaje claro.
-- El cliente (almacen.js registerMovement) pasa a llamar a esta RPC.
-- Verificado (REST owner): salida 5 -> stock 5; salida 100 -> 400 "Stock insuficiente" (sin cambio);
--      entrada 3 -> stock 8; qty 0 -> 400. Localhost: entrada por UI (20->25); salida excesiva por UI
--      rechazada (stock intacto, 0 movimientos extra) con toast "El stock no puede quedar en negativo".
-- Datos previos: 12 productos, 0 con stock<0 -> el CHECK valida sin conflicto.
-- Rollback: DROP FUNCTION register_stock_movement(bigint,numeric,text);
--           ALTER TABLE products DROP CONSTRAINT products_stock_non_negative; (y revertir almacen.js).

ALTER TABLE public.products
  ADD CONSTRAINT products_stock_non_negative CHECK (stock >= 0) NOT VALID;
ALTER TABLE public.products VALIDATE CONSTRAINT products_stock_non_negative;

CREATE OR REPLACE FUNCTION public.register_stock_movement(
  p_product_id bigint,
  p_qty numeric,
  p_type text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_business uuid := public.get_current_business_id();
  v_new_stock numeric;
  v_name text;
BEGIN
  IF p_type NOT IN ('in','out') THEN
    RAISE EXCEPTION 'Tipo de movimiento invalido: %', p_type USING ERRCODE = '22023';
  END IF;
  IF p_qty IS NULL OR p_qty <= 0 THEN
    RAISE EXCEPTION 'La cantidad debe ser mayor que 0' USING ERRCODE = '22023';
  END IF;
  IF NOT public.has_permission_secure(v_business, 'warehouse.move') THEN
    RAISE EXCEPTION 'No autorizado: requiere permiso warehouse.move' USING ERRCODE = '42501';
  END IF;

  IF p_type = 'in' THEN
    UPDATE public.products
      SET stock = stock + p_qty, updated_at = now()
      WHERE id = p_product_id AND user_id = v_business
      RETURNING stock, name INTO v_new_stock, v_name;
  ELSE
    UPDATE public.products
      SET stock = stock - p_qty, updated_at = now()
      WHERE id = p_product_id AND user_id = v_business AND stock >= p_qty
      RETURNING stock, name INTO v_new_stock, v_name;
  END IF;

  IF NOT FOUND THEN
    IF EXISTS (SELECT 1 FROM public.products WHERE id = p_product_id AND user_id = v_business) THEN
      RAISE EXCEPTION 'Stock insuficiente para realizar la salida' USING ERRCODE = '23514';
    ELSE
      RAISE EXCEPTION 'Producto no encontrado en el negocio' USING ERRCODE = 'P0002';
    END IF;
  END IF;

  INSERT INTO public.movements (product_id, qty, type, user_id)
  VALUES (p_product_id, p_qty, p_type, v_business);

  RETURN jsonb_build_object(
    'product_id', p_product_id,
    'name', v_name,
    'new_stock', v_new_stock,
    'type', p_type,
    'qty', p_qty
  );
END;
$$;

REVOKE ALL ON FUNCTION public.register_stock_movement(bigint, numeric, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.register_stock_movement(bigint, numeric, text) TO authenticated;
