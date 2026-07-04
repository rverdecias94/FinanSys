-- Idempotencia de la venta conectada (S7): evita ventas duplicadas cuando la respuesta
-- de register_sale se pierde por mala conexión (frecuente en Cuba) y el usuario reintenta.
--
-- Aplicada al remoto vía MCP el 2026-07-04 (migración `register_sale_idempotent`).
-- Verificada con prueba SQL con ROLLBACK: dos llamadas con el mismo client_uuid crean UNA
-- sola transacción, la 2ª devuelve idempotent:true y el stock baja una sola vez.

-- 1) Huella de idempotencia por venta (única por negocio cuando está presente).
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS client_uuid uuid;

CREATE UNIQUE INDEX IF NOT EXISTS transactions_user_client_uuid_uidx
  ON public.transactions (user_id, client_uuid) WHERE client_uuid IS NOT NULL;

-- 2) register_sale con guarda de idempotencia (parámetro opcional p_client_uuid).
--    Retrocompatible: llamar sin el 5º arg equivale al comportamiento anterior.
DROP FUNCTION IF EXISTS public.register_sale(jsonb, bigint, numeric, numeric);

CREATE FUNCTION public.register_sale(
  p_payload jsonb,
  p_product_id bigint,
  p_qty numeric,
  p_unit_price numeric,
  p_client_uuid uuid DEFAULT NULL
) RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_business  uuid := public.get_current_business_id();
  v_stock_old numeric;
  v_avg       numeric;
  v_currency  text;
  v_name      text;
  v_amount    numeric;
  v_status    text;
  v_paid      numeric;
  v_due       timestamptz;
  v_tx_id     bigint;
begin
  if v_business is null then
    raise exception 'No hay negocio en contexto' using errcode = '42501';
  end if;
  if p_qty is null or p_qty <= 0 then
    raise exception 'La cantidad debe ser mayor que 0' using errcode = '22023';
  end if;
  if p_unit_price is null or p_unit_price < 0 then
    raise exception 'El precio de venta no puede ser negativo' using errcode = '22023';
  end if;
  if not public.has_permission_secure(v_business, 'finanzas.create') then
    raise exception 'No autorizado: requiere permiso finanzas.create' using errcode = '42501';
  end if;
  if not public.has_permission_secure(v_business, 'warehouse.move') then
    raise exception 'No autorizado: requiere permiso warehouse.move' using errcode = '42501';
  end if;

  -- IDEMPOTENCIA (reintento tras respuesta perdida): si ya existe una venta con este
  -- client_uuid en el negocio, la devolvemos sin duplicar ingreso ni descuento de stock.
  if p_client_uuid is not null then
    select id, amount, currency into v_tx_id, v_amount, v_currency
    from public.transactions
    where user_id = v_business and client_uuid = p_client_uuid;
    if found then
      return jsonb_build_object(
        'transaction_id', v_tx_id,
        'amount',         v_amount,
        'currency',       v_currency,
        'idempotent',     true
      );
    end if;
  end if;

  select stock, avg_cost, currency, name into v_stock_old, v_avg, v_currency, v_name
  from public.products
  where id = p_product_id and user_id = v_business
  for update;
  if not found then
    raise exception 'Producto no encontrado en el negocio' using errcode = 'P0002';
  end if;
  if v_stock_old < p_qty then
    raise exception 'Stock insuficiente para la venta' using errcode = '23514';
  end if;

  v_amount := p_qty * p_unit_price;

  v_status := coalesce(p_payload->>'status', 'paid');
  if v_status <> 'paid' then v_status := 'pending'; end if;
  v_paid := case when v_status = 'paid' then v_amount else 0 end;
  v_due  := case when v_status = 'paid' then null
                 else nullif(p_payload->>'due_date', '')::timestamptz end;

  -- INSERT del ingreso con el client_uuid; si un reintento concurrente ya lo insertó,
  -- capturamos la colisión del índice único y devolvemos la venta ya creada (sin
  -- descontar stock de nuevo, porque el UPDATE de stock va después de este bloque).
  begin
    insert into public.transactions (
      user_id, date, amount, currency, category, description, type,
      contact_id, status, due_date, paid_amount, details, client_uuid
    ) values (
      v_business,
      coalesce(nullif(p_payload->>'date', '')::timestamptz, now()),
      v_amount,
      v_currency,
      coalesce(nullif(p_payload->>'category', ''), 'Ventas'),
      coalesce(nullif(p_payload->>'description', ''), 'Venta de ' || v_name),
      'income',
      nullif(p_payload->>'contact_id', '')::bigint,
      v_status,
      v_due,
      v_paid,
      jsonb_build_object('payment_method', p_payload->>'payment_method', 'sale', true),
      p_client_uuid
    )
    returning id into v_tx_id;
  exception when unique_violation then
    select id, amount, currency into v_tx_id, v_amount, v_currency
    from public.transactions
    where user_id = v_business and client_uuid = p_client_uuid;
    return jsonb_build_object(
      'transaction_id', v_tx_id,
      'amount',         v_amount,
      'currency',       v_currency,
      'idempotent',     true
    );
  end;

  update public.products
    set stock = stock - p_qty, updated_at = now()
    where id = p_product_id and user_id = v_business;

  insert into public.movements (product_id, qty, type, user_id, unit_cost, transaction_id, moved_at)
  values (p_product_id, p_qty, 'out', v_business, v_avg, v_tx_id, now());

  insert into public.sale_items (user_id, transaction_id, product_id, qty, unit_price, unit_cost)
  values (v_business, v_tx_id, p_product_id, p_qty, p_unit_price, v_avg);

  return jsonb_build_object(
    'transaction_id', v_tx_id,
    'amount',         v_amount,
    'currency',       v_currency,
    'cogs',           v_avg * p_qty,
    'margin',         (p_unit_price - v_avg) * p_qty,
    'new_stock',      v_stock_old - p_qty
  );
end;
$function$;
