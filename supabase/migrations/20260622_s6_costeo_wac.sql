-- 20260622_s6_costeo_wac.sql
-- S6 (Q4) — Costeo Promedio Ponderado (WAC) en entradas + COGS sellado en salidas.
-- ----------------------------------------------------------------------------
-- EXPAND · idempotente. Toca datos REALES (12 products, 10 movements): es aditivo,
-- con backfill de moved_at desde created_at (no la fecha de la migración).
--  * products.avg_cost arranca en 0 (no hay costo histórico) y empieza a acumular
--    desde la primera entrada con costo.
--  * register_stock_movement gana p_unit_cost (4º arg, default null) → el cliente
--    que llama con 3 args sigue funcionando. Se DROPea la firma de 3 args para
--    evitar un overload ambiguo.
-- ----------------------------------------------------------------------------

-- 1) Esquema de costo
alter table public.products  add column if not exists avg_cost numeric not null default 0;
alter table public.movements add column if not exists unit_cost numeric;
alter table public.movements add column if not exists transaction_id bigint
  references public.transactions(id) on delete set null;

-- moved_at: fecha de negocio del movimiento. Backfill desde created_at para los
-- movimientos existentes, luego default now() + not null.
alter table public.movements add column if not exists moved_at timestamptz;
update public.movements set moved_at = coalesce(created_at, now()) where moved_at is null;
alter table public.movements alter column moved_at set default now();
alter table public.movements alter column moved_at set not null;

create index if not exists idx_movements_tx
  on public.movements(transaction_id) where transaction_id is not null;

-- 2) register_stock_movement con p_unit_cost (compatible con las llamadas de 3 args).
drop function if exists public.register_stock_movement(bigint, numeric, text);

create or replace function public.register_stock_movement(
  p_product_id bigint,
  p_qty        numeric,
  p_type       text,
  p_unit_cost  numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_business  uuid := public.get_current_business_id();
  v_stock_old numeric;
  v_avg_old   numeric;
  v_name      text;
  v_new_stock numeric;
  v_avg_new   numeric;
  v_unit_cost numeric;
begin
  if p_type not in ('in','out') then
    raise exception 'Tipo de movimiento invalido: %', p_type using errcode = '22023';
  end if;
  if p_qty is null or p_qty <= 0 then
    raise exception 'La cantidad debe ser mayor que 0' using errcode = '22023';
  end if;
  if p_unit_cost is not null and p_unit_cost < 0 then
    raise exception 'El costo unitario no puede ser negativo' using errcode = '22023';
  end if;
  if not public.has_permission_secure(v_business, 'warehouse.move') then
    raise exception 'No autorizado: requiere permiso warehouse.move' using errcode = '42501';
  end if;

  -- Lock de la fila del producto del negocio.
  select stock, avg_cost, name into v_stock_old, v_avg_old, v_name
  from public.products
  where id = p_product_id and user_id = v_business
  for update;

  if not found then
    raise exception 'Producto no encontrado en el negocio' using errcode = 'P0002';
  end if;

  if p_type = 'in' then
    -- WAC: solo recalcula el promedio si la entrada trae costo; si no, lo conserva.
    if p_unit_cost is not null then
      v_avg_new := case when (v_stock_old + p_qty) > 0
                        then (v_avg_old * v_stock_old + p_unit_cost * p_qty) / (v_stock_old + p_qty)
                        else 0 end;
      v_unit_cost := p_unit_cost;
    else
      v_avg_new := v_avg_old;
      v_unit_cost := null;
    end if;

    update public.products
      set stock = stock + p_qty, avg_cost = v_avg_new, updated_at = now()
      where id = p_product_id and user_id = v_business
      returning stock into v_new_stock;
  else
    -- Salida: valida stock y sella el COGS = avg_cost actual.
    if v_stock_old < p_qty then
      raise exception 'Stock insuficiente para realizar la salida' using errcode = '23514';
    end if;
    v_unit_cost := v_avg_old;
    update public.products
      set stock = stock - p_qty, updated_at = now()
      where id = p_product_id and user_id = v_business
      returning stock into v_new_stock;
  end if;

  insert into public.movements (product_id, qty, type, user_id, unit_cost, moved_at)
  values (p_product_id, p_qty, p_type, v_business, v_unit_cost, now());

  return jsonb_build_object(
    'product_id', p_product_id,
    'name',       v_name,
    'new_stock',  v_new_stock,
    'type',       p_type,
    'qty',        p_qty,
    'unit_cost',  v_unit_cost,
    'avg_cost',   case when p_type = 'in' then v_avg_new else v_avg_old end
  );
end;
$$;

revoke all on function public.register_stock_movement(bigint, numeric, text, numeric) from public;
grant execute on function public.register_stock_movement(bigint, numeric, text, numeric) to authenticated;

-- ----------------------------------------------------------------------------
-- ROLLBACK (manual):
--   drop function if exists public.register_stock_movement(bigint, numeric, text, numeric);
--   -- recrear la versión de 3 args desde 20260618_p1_6_p1_7_atomic_stock_movement.sql si se necesita
--   drop index if exists public.idx_movements_tx;
--   alter table public.movements drop column if exists moved_at,
--                                drop column if exists transaction_id,
--                                drop column if exists unit_cost;
--   alter table public.products drop column if exists avg_cost;
-- ----------------------------------------------------------------------------
