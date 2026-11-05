-- A2 — Flujos estructurados: recepción/ajuste/conteo + aprobación simple
-- ----------------------------------------------------------------------------

-- Umbral de aprobación (valor absoluto de ajuste) en business_settings JSON opcional;
-- RPC helper para crear documento draft tipado.

create or replace function public.create_warehouse_document(
  p_doc_type text,
  p_lines jsonb,
  p_partner_name text default null,
  p_reason_code text default null,
  p_notes text default null,
  p_source_ref text default null,
  p_require_approval boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_business uuid := public.get_current_business_id();
  v_doc_id bigint;
  v_number text;
  v_prefix text;
  v_status text := 'draft';
  v_line jsonb;
  v_qty numeric;
  v_product_id bigint;
begin
  if not public.has_permission_secure(v_business, 'warehouse.move') then
    raise exception 'No autorizado: requiere permiso warehouse.move' using errcode = '42501';
  end if;

  if p_doc_type not in ('receipt','issue','adjustment','transfer','count','return','quick_in','quick_out') then
    raise exception 'Tipo de documento invalido' using errcode = '22023';
  end if;

  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'Se requiere al menos una línea' using errcode = '22023';
  end if;

  if p_doc_type = 'adjustment' and (p_reason_code is null or trim(p_reason_code) = '') then
    raise exception 'El ajuste requiere un motivo' using errcode = '22023';
  end if;

  perform public.ensure_warehouse_reason_codes();

  v_prefix := case p_doc_type
    when 'receipt' then 'REC'
    when 'issue' then 'SAL'
    when 'adjustment' then 'AJU'
    when 'transfer' then 'TRF'
    when 'count' then 'CNT'
    when 'return' then 'DEV'
    else 'ALM'
  end;

  v_number := public.next_warehouse_doc_number(v_prefix);
  if p_require_approval then
    v_status := 'pending_approval';
  end if;

  insert into public.warehouse_documents (
    user_id, doc_type, doc_number, status, partner_name, reason_code, notes, source_ref, created_by
  ) values (
    v_business, p_doc_type, v_number, v_status, p_partner_name, p_reason_code, p_notes, p_source_ref, auth.uid()
  ) returning id into v_doc_id;

  for v_line in select * from jsonb_array_elements(p_lines)
  loop
    v_product_id := (v_line->>'product_id')::bigint;
    v_qty := (v_line->>'qty')::numeric;
    if v_product_id is null or v_qty is null or v_qty <= 0 then
      raise exception 'Línea inválida (product_id/qty)' using errcode = '22023';
    end if;
    if not exists (select 1 from public.products p where p.id = v_product_id and p.user_id = v_business) then
      raise exception 'Producto % no pertenece al negocio', v_product_id using errcode = 'P0002';
    end if;

    insert into public.warehouse_document_lines (
      document_id, product_id, qty, unit_cost, lot_text, serial_text,
      location_text, location_to_text, notes
    ) values (
      v_doc_id,
      v_product_id,
      v_qty,
      nullif(v_line->>'unit_cost', '')::numeric,
      nullif(v_line->>'lot_text', ''),
      nullif(v_line->>'serial_text', ''),
      nullif(v_line->>'location_text', ''),
      nullif(v_line->>'location_to_text', ''),
      nullif(v_line->>'notes', '')
    );
  end loop;

  return jsonb_build_object(
    'document_id', v_doc_id,
    'doc_number', v_number,
    'status', v_status,
    'doc_type', p_doc_type
  );
end;
$$;

revoke all on function public.create_warehouse_document(text, jsonb, text, text, text, text, boolean) from public;
grant execute on function public.create_warehouse_document(text, jsonb, text, text, text, text, boolean) to authenticated;

-- Crear ajuste desde conteo (system_qty vs counted_qty)
create or replace function public.create_count_adjustment(
  p_product_id bigint,
  p_system_qty numeric,
  p_counted_qty numeric,
  p_notes text default null,
  p_auto_post boolean default false,
  p_approval_threshold numeric default 5
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_diff numeric;
  v_lines jsonb;
  v_sign text;
  v_qty numeric;
  v_need_approval boolean := false;
  v_doc jsonb;
  v_posted jsonb;
begin
  v_diff := coalesce(p_counted_qty, 0) - coalesce(p_system_qty, 0);
  if v_diff = 0 then
    return jsonb_build_object('ok', true, 'message', 'Sin diferencia', 'diff', 0);
  end if;

  v_qty := abs(v_diff);
  v_sign := case when v_diff < 0 then 'out' else 'in' end;
  if abs(v_diff) > coalesce(p_approval_threshold, 5) then
    v_need_approval := true;
  end if;

  v_lines := jsonb_build_array(jsonb_build_object(
    'product_id', p_product_id,
    'qty', v_qty,
    'location_to_text', v_sign,
    'notes', format('Conteo sistema=%s físico=%s', p_system_qty, p_counted_qty)
  ));

  v_doc := public.create_warehouse_document(
    'adjustment',
    v_lines,
    null,
    'COUNT_DIFF',
    coalesce(p_notes, 'Ajuste por conteo'),
    null,
    v_need_approval
  );

  if p_auto_post and not v_need_approval then
    v_posted := public.post_warehouse_document((v_doc->>'document_id')::bigint);
    return v_doc || jsonb_build_object('posted', v_posted, 'diff', v_diff);
  end if;

  return v_doc || jsonb_build_object('diff', v_diff, 'needs_approval', v_need_approval);
end;
$$;

revoke all on function public.create_count_adjustment(bigint, numeric, numeric, text, boolean, numeric) from public;
grant execute on function public.create_count_adjustment(bigint, numeric, numeric, text, boolean, numeric) to authenticated;

-- Aprobar documento pendiente (solo owner del negocio = auth.uid() = business, o quien tenga move y sea owner)
create or replace function public.approve_warehouse_document(p_doc_id bigint)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_business uuid := public.get_current_business_id();
  v_doc public.warehouse_documents%rowtype;
  v_is_owner boolean;
begin
  v_is_owner := (auth.uid() = v_business);
  if not v_is_owner then
    raise exception 'Solo el titular puede aprobar documentos de almacén' using errcode = '42501';
  end if;

  select * into v_doc from public.warehouse_documents
  where id = p_doc_id and user_id = v_business for update;

  if not found then
    raise exception 'Documento no encontrado' using errcode = 'P0002';
  end if;
  if v_doc.status <> 'pending_approval' then
    raise exception 'El documento no está pendiente de aprobación' using errcode = '22023';
  end if;

  update public.warehouse_documents
    set status = 'draft', approved_by = auth.uid(), updated_at = now()
  where id = p_doc_id;

  return public.post_warehouse_document(p_doc_id);
end;
$$;

revoke all on function public.approve_warehouse_document(bigint) from public;
grant execute on function public.approve_warehouse_document(bigint) to authenticated;
