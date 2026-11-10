-- ============================================================================
-- P0-006 — Cierre de período también aplica a almacén
-- ============================================================================
-- - Movimientos nuevos: bloqueados si current_date <= closed_through.
-- - Reverso: bloqueado si el documento original se postó en período cerrado
--   (posted_at::date <= closed_through), aunque hoy esté abierto.
-- ============================================================================

create or replace function public.assert_period_open_for_date(p_business uuid, p_date date)
returns void
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_lock date;
begin
  if p_business is null or p_date is null then
    return;
  end if;
  select closed_through into v_lock
  from public.period_locks
  where user_id = p_business;
  if v_lock is not null and p_date <= v_lock then
    raise exception
      'Período cerrado hasta %. No puedes alterar el almacén en ese período.',
      to_char(v_lock, 'DD/MM/YYYY')
      using errcode = 'P0010';
  end if;
end;
$$;

revoke all on function public.assert_period_open_for_date(uuid, date) from public;
revoke all on function public.assert_period_open_for_date(uuid, date) from anon;
grant execute on function public.assert_period_open_for_date(uuid, date) to authenticated;

create or replace function public.register_stock_movement(
  p_product_id bigint,
  p_qty numeric,
  p_type text,
  p_unit_cost numeric default null,
  p_document_id bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_business uuid := public.get_current_business_id();
  v_stock_old numeric;
  v_avg_old numeric;
  v_name text;
  v_new_stock numeric;
  v_avg_new numeric;
  v_unit_cost numeric;
  v_movement_id bigint;
begin
  if p_type not in ('in', 'out') then
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

  perform public.assert_period_open_for_date(v_business, current_date);

  if p_document_id is not null and not exists (
    select 1 from public.warehouse_documents d
    where d.id = p_document_id and d.user_id = v_business
  ) then
    raise exception 'Documento de almacén no encontrado' using errcode = 'P0002';
  end if;

  select stock, avg_cost, name
  into v_stock_old, v_avg_old, v_name
  from public.products
  where id = p_product_id and user_id = v_business
  for update;

  if not found then
    raise exception 'Producto no encontrado en el negocio' using errcode = 'P0002';
  end if;

  if p_type = 'in' then
    if p_unit_cost is not null then
      v_avg_new := case
        when (v_stock_old + p_qty) > 0
          then (v_avg_old * v_stock_old + p_unit_cost * p_qty) / (v_stock_old + p_qty)
        else 0
      end;
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
    if v_stock_old < p_qty then
      raise exception 'Stock insuficiente para realizar la salida' using errcode = '23514';
    end if;
    v_unit_cost := v_avg_old;
    update public.products
    set stock = stock - p_qty, updated_at = now()
    where id = p_product_id and user_id = v_business
    returning stock into v_new_stock;
  end if;

  insert into public.movements (product_id, qty, type, user_id, unit_cost, moved_at, document_id)
  values (p_product_id, p_qty, p_type, v_business, v_unit_cost, now(), p_document_id)
  returning id into v_movement_id;

  return jsonb_build_object(
    'product_id', p_product_id,
    'name', v_name,
    'new_stock', v_new_stock,
    'type', p_type,
    'qty', p_qty,
    'unit_cost', v_unit_cost,
    'avg_cost', case when p_type = 'in' then v_avg_new else v_avg_old end,
    'movement_id', v_movement_id,
    'document_id', p_document_id
  );
end;
$$;

revoke all on function public.register_stock_movement(bigint, numeric, text, numeric, bigint) from public;
revoke all on function public.register_stock_movement(bigint, numeric, text, numeric, bigint) from anon;
grant execute on function public.register_stock_movement(bigint, numeric, text, numeric, bigint) to authenticated;

-- Wrapper 4-arg intacto
create or replace function public.register_stock_movement(
  p_product_id bigint,
  p_qty numeric,
  p_type text,
  p_unit_cost numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  return public.register_stock_movement(p_product_id, p_qty, p_type, p_unit_cost, null);
end;
$$;

revoke all on function public.register_stock_movement(bigint, numeric, text, numeric) from public;
revoke all on function public.register_stock_movement(bigint, numeric, text, numeric) from anon;
grant execute on function public.register_stock_movement(bigint, numeric, text, numeric) to authenticated;

-- Patch reverse: bloquea si el original pertenece a período cerrado
create or replace function public.reverse_warehouse_document(p_doc_id bigint, p_notes text default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_business uuid := public.get_current_business_id();
  v_doc public.warehouse_documents%rowtype;
  v_rev_id bigint;
  v_number text;
  v_line record;
  v_posted jsonb;
  v_product_id bigint;
  v_posted_date date;
begin
  if not public.has_permission_secure(v_business, 'warehouse.move') then
    raise exception 'No autorizado: requiere permiso warehouse.move' using errcode = '42501';
  end if;

  select * into v_doc
  from public.warehouse_documents
  where id = p_doc_id and user_id = v_business
  for update;

  if not found then
    raise exception 'Documento no encontrado' using errcode = 'P0002';
  end if;
  if v_doc.status <> 'posted' then
    raise exception 'Solo se pueden revertir documentos postados' using errcode = '22023';
  end if;

  v_posted_date := coalesce(v_doc.posted_at::date, v_doc.created_at::date, current_date);
  perform public.assert_period_open_for_date(v_business, v_posted_date);
  perform public.assert_period_open_for_date(v_business, current_date);

  v_number := public.next_warehouse_doc_number('REV');

  insert into public.warehouse_documents (
    user_id, doc_type, doc_number, status, notes, source_ref, reversed_of, created_by
  ) values (
    v_business, v_doc.doc_type, v_number, 'draft',
    coalesce(p_notes, 'Reverso de ' || v_doc.doc_number),
    v_doc.doc_number, p_doc_id, auth.uid()
  )
  returning id into v_rev_id;

  for v_line in
    select * from public.warehouse_document_lines where document_id = p_doc_id order by id
  loop
    insert into public.warehouse_document_lines (
      document_id, product_id, qty, unit_cost, lot_text, serial_text,
      location_text, location_to_text, notes
    ) values (
      v_rev_id, v_line.product_id, v_line.qty, v_line.unit_cost,
      v_line.lot_text, v_line.serial_text, v_line.location_text,
      case
        when v_doc.doc_type in ('adjustment', 'count') then
          case when coalesce(v_line.location_to_text, 'in') = 'out' then 'in' else 'out' end
        when v_doc.doc_type in ('receipt', 'quick_in', 'return') then 'out'
        when v_doc.doc_type in ('issue', 'quick_out') then 'in'
        else coalesce(v_line.location_to_text, 'out')
      end,
      'reverso'
    );
  end loop;

  if v_doc.doc_type in ('receipt', 'quick_in', 'return') then
    update public.warehouse_documents set doc_type = 'quick_out' where id = v_rev_id;
  elsif v_doc.doc_type in ('issue', 'quick_out') then
    update public.warehouse_documents set doc_type = 'quick_in' where id = v_rev_id;
  elsif v_doc.doc_type = 'transfer' then
    null;
  else
    update public.warehouse_documents set doc_type = 'adjustment' where id = v_rev_id;
  end if;

  v_posted := public.post_warehouse_document(v_rev_id);

  update public.warehouse_documents
  set status = 'reversed', updated_at = now()
  where id = p_doc_id;

  for v_product_id in
    select distinct product_id
    from public.warehouse_document_lines
    where document_id = p_doc_id
  loop
    perform public.recompute_product_avg_cost(v_product_id);
  end loop;

  return jsonb_build_object(
    'original_id', p_doc_id,
    'reversal_id', v_rev_id,
    'reversal_number', v_number,
    'result', v_posted
  );
end;
$$;

revoke all on function public.reverse_warehouse_document(bigint, text) from public;
revoke all on function public.reverse_warehouse_document(bigint, text) from anon;
grant execute on function public.reverse_warehouse_document(bigint, text) to authenticated;
