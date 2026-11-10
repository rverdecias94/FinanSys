-- ============================================================================
-- P0-007 — Conteo físico sin TOCTOU
-- ============================================================================
-- Antes: el diff usaba p_system_qty del cliente → carrera con movimientos intermedios.
-- Ahora: SELECT … FOR UPDATE del producto; diff = counted − stock real.
-- Si el snapshot del cliente no coincide, se ajusta con stock real y se marca stale_snapshot.
-- ============================================================================

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
  v_business uuid := public.get_current_business_id();
  v_stock numeric;
  v_stale boolean := false;
  v_diff numeric;
  v_lines jsonb;
  v_sign text;
  v_qty numeric;
  v_need_approval boolean := false;
  v_doc jsonb;
  v_posted jsonb;
begin
  if not public.has_permission_secure(v_business, 'warehouse.move') then
    raise exception 'No autorizado: requiere permiso warehouse.move' using errcode = '42501';
  end if;

  perform public.assert_period_open_for_date(v_business, current_date);

  if p_counted_qty is null or p_counted_qty < 0 then
    raise exception 'La cantidad contada debe ser mayor o igual a 0' using errcode = '22023';
  end if;

  select stock into v_stock
  from public.products
  where id = p_product_id and user_id = v_business
  for update;

  if not found then
    raise exception 'Producto no encontrado en el negocio' using errcode = 'P0002';
  end if;

  if p_system_qty is not null and abs(coalesce(p_system_qty, 0) - v_stock) > 0.0001 then
    v_stale := true;
  end if;

  v_diff := coalesce(p_counted_qty, 0) - v_stock;

  if v_diff = 0 then
    return jsonb_build_object(
      'ok', true,
      'message', 'Sin diferencia',
      'diff', 0,
      'system_qty_used', v_stock,
      'stale_snapshot', v_stale
    );
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
    'notes', format('Conteo sistema=%s físico=%s', v_stock, p_counted_qty)
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
    return v_doc || jsonb_build_object(
      'posted', v_posted,
      'diff', v_diff,
      'system_qty_used', v_stock,
      'stale_snapshot', v_stale
    );
  end if;

  return v_doc || jsonb_build_object(
    'diff', v_diff,
    'needs_approval', v_need_approval,
    'system_qty_used', v_stock,
    'stale_snapshot', v_stale
  );
end;
$$;

revoke all on function public.create_count_adjustment(bigint, numeric, numeric, text, boolean, numeric) from public;
revoke all on function public.create_count_adjustment(bigint, numeric, numeric, text, boolean, numeric) from anon;
grant execute on function public.create_count_adjustment(bigint, numeric, numeric, text, boolean, numeric) to authenticated;
