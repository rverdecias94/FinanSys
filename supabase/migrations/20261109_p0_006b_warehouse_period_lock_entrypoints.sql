-- ============================================================================
-- P0-006b — Guard de período al inicio de los entrypoints de almacén
-- ============================================================================
-- register_stock_movement (5-arg) ya bloquea. Aquí se falla tempr:
--   - post_warehouse_document: antes de tocar líneas
--   - create_and_post_quick_movement: antes de crear el draft (salvo idempotencia)
-- ============================================================================

create or replace function public.post_warehouse_document(p_doc_id bigint)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_business uuid := public.get_current_business_id();
  v_doc public.warehouse_documents%rowtype;
  v_line record;
  v_move_type text;
  v_result jsonb;
  v_results jsonb := '[]'::jsonb;
  v_unit_cost numeric;
begin
  if not public.has_permission_secure(v_business, 'warehouse.move') then
    raise exception 'No autorizado: requiere permiso warehouse.move' using errcode = '42501';
  end if;

  perform public.assert_period_open_for_date(v_business, current_date);

  select * into v_doc
  from public.warehouse_documents
  where id = p_doc_id and user_id = v_business
  for update;

  if not found then
    raise exception 'Documento no encontrado' using errcode = 'P0002';
  end if;

  if v_doc.status = 'pending_approval' then
    raise exception 'Documento pendiente de aprobación: solo el titular puede aprobarlo'
      using errcode = '42501';
  end if;

  if v_doc.status <> 'draft' then
    raise exception 'Solo se pueden postear documentos en borrador' using errcode = '22023';
  end if;

  if not exists (select 1 from public.warehouse_document_lines where document_id = p_doc_id) then
    raise exception 'El documento no tiene líneas' using errcode = '22023';
  end if;

  for v_line in
    select * from public.warehouse_document_lines where document_id = p_doc_id order by id
  loop
    if v_doc.doc_type in ('receipt', 'quick_in', 'return') then
      v_move_type := 'in';
      v_unit_cost := v_line.unit_cost;
    elsif v_doc.doc_type in ('issue', 'quick_out') then
      v_move_type := 'out';
      v_unit_cost := null;
    elsif v_doc.doc_type in ('adjustment', 'count') then
      if coalesce(v_line.location_to_text, 'in') = 'out' then
        v_move_type := 'out';
        v_unit_cost := null;
      else
        v_move_type := 'in';
        v_unit_cost := v_line.unit_cost;
      end if;
    elsif v_doc.doc_type = 'transfer' then
      v_result := public.register_stock_movement(v_line.product_id, v_line.qty, 'out', null, p_doc_id);
      v_results := v_results || jsonb_build_array(v_result);
      v_result := public.register_stock_movement(v_line.product_id, v_line.qty, 'in', null, p_doc_id);
      v_results := v_results || jsonb_build_array(v_result);
      continue;
    else
      raise exception 'Tipo de documento no soportado: %', v_doc.doc_type using errcode = '22023';
    end if;

    v_result := public.register_stock_movement(
      v_line.product_id, v_line.qty, v_move_type, v_unit_cost, p_doc_id
    );
    v_results := v_results || jsonb_build_array(v_result);
  end loop;

  update public.warehouse_documents
  set status = 'posted',
      posted_at = now(),
      updated_at = now(),
      approved_by = coalesce(approved_by, auth.uid())
  where id = p_doc_id;

  return jsonb_build_object(
    'document_id', p_doc_id,
    'doc_number', v_doc.doc_number,
    'status', 'posted',
    'movements', v_results
  );
end;
$$;

revoke all on function public.post_warehouse_document(bigint) from public;
revoke all on function public.post_warehouse_document(bigint) from anon;
grant execute on function public.post_warehouse_document(bigint) to authenticated;

create or replace function public.create_and_post_quick_movement(
  p_product_id bigint,
  p_qty numeric,
  p_type text,
  p_unit_cost numeric default null,
  p_notes text default null,
  p_client_uuid uuid default null,
  p_fx_units_per_base numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_business uuid := public.get_current_business_id();
  v_doc_id bigint;
  v_doc public.warehouse_documents%rowtype;
  v_doc_type text;
  v_prefix text;
  v_number text;
  v_posted jsonb;
  v_line public.warehouse_document_lines%rowtype;
  v_name text;
  v_stock numeric;
  v_unit_cost numeric;
begin
  if p_type not in ('in', 'out') then
    raise exception 'Tipo de movimiento invalido: %', p_type using errcode = '22023';
  end if;
  if not public.has_permission_secure(v_business, 'warehouse.move') then
    raise exception 'No autorizado: requiere permiso warehouse.move' using errcode = '42501';
  end if;

  -- Idempotencia: devolver el doc existente sin revalidar período
  if p_client_uuid is not null then
    select * into v_doc
    from public.warehouse_documents
    where user_id = v_business and client_uuid = p_client_uuid;
    if found then
      select * into v_line
      from public.warehouse_document_lines
      where document_id = v_doc.id
      order by id
      limit 1;
      select name, stock, avg_cost into v_name, v_stock, v_unit_cost
      from public.products
      where id = coalesce(v_line.product_id, p_product_id) and user_id = v_business;
      return jsonb_build_object(
        'document_id', v_doc.id,
        'doc_number', v_doc.doc_number,
        'product_id', coalesce(v_line.product_id, p_product_id),
        'qty', coalesce(v_line.qty, p_qty),
        'type', case when v_doc.doc_type = 'quick_in' then 'in' else 'out' end,
        'name', v_name,
        'new_stock', v_stock,
        'unit_cost', coalesce(v_line.unit_cost, v_unit_cost),
        'idempotent', true
      );
    end if;
  end if;

  perform public.assert_period_open_for_date(v_business, current_date);

  v_doc_type := case when p_type = 'in' then 'quick_in' else 'quick_out' end;
  v_prefix := case when p_type = 'in' then 'QIN' else 'QOUT' end;
  v_number := public.next_warehouse_doc_number(v_prefix);

  begin
    insert into public.warehouse_documents (
      user_id, doc_type, doc_number, status, notes, created_by, client_uuid
    ) values (
      v_business, v_doc_type, v_number, 'draft', p_notes, auth.uid(), p_client_uuid
    ) returning id into v_doc_id;
  exception
    when unique_violation then
      if p_client_uuid is not null then
        select * into v_doc
        from public.warehouse_documents
        where user_id = v_business and client_uuid = p_client_uuid;
        if found then
          select * into v_line
          from public.warehouse_document_lines
          where document_id = v_doc.id
          order by id
          limit 1;
          select name, stock, avg_cost into v_name, v_stock, v_unit_cost
          from public.products
          where id = coalesce(v_line.product_id, p_product_id) and user_id = v_business;
          return jsonb_build_object(
            'document_id', v_doc.id,
            'doc_number', v_doc.doc_number,
            'product_id', coalesce(v_line.product_id, p_product_id),
            'qty', coalesce(v_line.qty, p_qty),
            'type', case when v_doc.doc_type = 'quick_in' then 'in' else 'out' end,
            'name', v_name,
            'new_stock', v_stock,
            'unit_cost', coalesce(v_line.unit_cost, v_unit_cost),
            'idempotent', true
          );
        end if;
      end if;
      raise;
  end;

  insert into public.warehouse_document_lines (document_id, product_id, qty, unit_cost)
  values (v_doc_id, p_product_id, p_qty, case when p_type = 'in' then p_unit_cost else null end);

  v_posted := public.post_warehouse_document(v_doc_id);

  if p_client_uuid is not null then
    update public.movements
    set client_uuid = p_client_uuid
    where document_id = v_doc_id
      and user_id = v_business
      and client_uuid is null;
  end if;

  if p_type = 'in' and p_fx_units_per_base is not null and p_fx_units_per_base > 0 then
    update public.movements
    set fx_units_per_base = p_fx_units_per_base
    where document_id = v_doc_id
      and user_id = v_business
      and type = 'in';
  end if;

  return v_posted || jsonb_build_object(
    'product_id', p_product_id,
    'qty', p_qty,
    'type', p_type,
    'name', (select name from public.products where id = p_product_id and user_id = v_business),
    'new_stock', (select stock from public.products where id = p_product_id and user_id = v_business),
    'unit_cost', case
      when p_type = 'in' then p_unit_cost
      else (select avg_cost from public.products where id = p_product_id and user_id = v_business)
    end,
    'fx_units_per_base', case when p_type = 'in' then p_fx_units_per_base else null end,
    'doc_number', v_number
  );
end;
$$;

revoke all on function public.create_and_post_quick_movement(bigint, numeric, text, numeric, text, uuid, numeric) from public;
revoke all on function public.create_and_post_quick_movement(bigint, numeric, text, numeric, text, uuid, numeric) from anon;
grant execute on function public.create_and_post_quick_movement(bigint, numeric, text, numeric, text, uuid, numeric) to authenticated;
