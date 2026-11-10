-- ============================================================================
-- P0-004 — No postear documentos pending_approval sin pasar por approve
-- ============================================================================
-- Antes: post_warehouse_document aceptaba status in ('draft','pending_approval')
-- con solo warehouse.move → un miembro saltaba approve_warehouse_document
-- (reservado al titular).
-- Ahora: solo se postean 'draft'. Los pendientes deben usar approve_* (que
-- exige titular, pasa a draft y llama a post).
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
