-- ============================================================================
-- P0-003 — Reverso de entrada no debe dejar avg_cost contaminado
-- ============================================================================
-- reverse_warehouse_document convierte receipt/quick_in/return en quick_out.
-- La rama 'out' de register_stock_movement no recalcula WAC → tras revertir
-- una entrada el promedio queda mal y el COGS posterior es incorrecto.
--
-- Fix: tras postear el reverso, recomputar avg_cost de cada producto afectado
-- a partir de movements de entradas con costo, excluyendo documentos ya
-- 'reversed' (la entrada original queda fuera del promedio).
-- ============================================================================

create or replace function public.recompute_product_avg_cost(p_product_id bigint)
returns numeric
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_business uuid := public.get_current_business_id();
  v_avg numeric := 0;
  v_qty numeric := 0;
  r record;
begin
  if v_business is null then
    raise exception 'No hay negocio en contexto' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.products
    where id = p_product_id and user_id = v_business
  ) then
    raise exception 'Producto no encontrado en el negocio' using errcode = 'P0002';
  end if;

  for r in
    select m.qty, m.type, m.unit_cost
    from public.movements m
    left join public.warehouse_documents d on d.id = m.document_id
    where m.product_id = p_product_id
      and m.user_id = v_business
      and (m.document_id is null or d.status is distinct from 'reversed')
    order by m.moved_at nulls last, m.id
  loop
    if r.type = 'in' then
      if r.unit_cost is not null and (v_qty + r.qty) > 0 then
        v_avg := (v_avg * v_qty + r.unit_cost * r.qty) / (v_qty + r.qty);
      end if;
      v_qty := v_qty + r.qty;
    elsif r.type = 'out' then
      v_qty := v_qty - r.qty;
      if v_qty < 0 then
        v_qty := 0;
      end if;
      if v_qty = 0 then
        v_avg := 0;
      end if;
    end if;
  end loop;

  update public.products
  set avg_cost = coalesce(v_avg, 0),
      updated_at = now()
  where id = p_product_id
    and user_id = v_business;

  return coalesce(v_avg, 0);
end;
$$;

revoke all on function public.recompute_product_avg_cost(bigint) from public;
revoke all on function public.recompute_product_avg_cost(bigint) from anon;
grant execute on function public.recompute_product_avg_cost(bigint) to authenticated;

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

  -- P0-003: restaurar WAC excluyendo movimientos del documento ya reversed.
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
