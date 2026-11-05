-- Inventario F4 — Reglas mínimas: baja requiere owner, conteo simple stock-like
-- ----------------------------------------------------------------------------

-- Baja siempre exige titular (endurece F3)
create or replace function public.record_inventory_asset_event(
  p_item_id bigint,
  p_event_type text,
  p_to_location text default null,
  p_to_custodian text default null,
  p_condition_in text default null,
  p_condition_out text default null,
  p_notes text default null,
  p_attachment_url text default null,
  p_require_owner_for_dispose boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_business uuid := public.get_current_business_id();
  v_item public.inventory_items%rowtype;
  v_area public.inventory_areas%rowtype;
  v_event_id bigint;
  v_values jsonb;
  v_new_status text;
begin
  if not public.has_permission_secure(v_business, 'inventory.edit') then
    raise exception 'No autorizado: requiere inventory.edit' using errcode = '42501';
  end if;
  if p_event_type not in ('intake','assign','return','transfer','maintenance','dispose') then
    raise exception 'Tipo de evento inválido' using errcode = '22023';
  end if;

  if p_event_type = 'dispose' and coalesce(p_require_owner_for_dispose, true) and auth.uid() <> v_business then
    raise exception 'Solo el titular puede dar de baja un activo' using errcode = '42501';
  end if;

  select * into v_item from public.inventory_items
  where id = p_item_id and user_id = v_business for update;
  if not found then
    raise exception 'Ítem no encontrado' using errcode = 'P0002';
  end if;

  select * into v_area from public.inventory_areas where id = v_item.area_id;
  if coalesce(v_area.plan_locked, false) then
    raise exception 'Área bloqueada por tu plan' using errcode = '53400';
  end if;

  if v_area.domain_type not in ('fixed_asset','tool') then
    raise exception 'Solo áreas de activos/herramientas admiten eventos' using errcode = '22023';
  end if;

  if lower(coalesce(v_item.status, '')) in ('baja', 'disposed') and p_event_type <> 'dispose' and p_event_type <> 'intake' then
    raise exception 'El activo está dado de baja; no admite nuevas asignaciones' using errcode = '22023';
  end if;

  insert into public.inventory_asset_events (
    user_id, item_id, event_type,
    from_location, to_location, from_custodian, to_custodian,
    condition_in, condition_out, notes, attachment_url, created_by
  ) values (
    v_business, p_item_id, p_event_type,
    v_item.location, p_to_location, v_item.custodian, p_to_custodian,
    p_condition_in, p_condition_out, p_notes, p_attachment_url, auth.uid()
  ) returning id into v_event_id;

  v_values := coalesce(v_item.values, '{}'::jsonb);

  if p_event_type = 'assign' then
    v_new_status := 'Asignado';
    if p_to_custodian is not null then
      v_values := jsonb_set(v_values, '{Custodio}', to_jsonb(p_to_custodian), true);
    end if;
    if p_to_location is not null then
      v_values := jsonb_set(v_values, '{Ubicación}', to_jsonb(p_to_location), true);
    end if;
    v_values := jsonb_set(v_values, '{Estado}', to_jsonb(v_new_status), true);
    update public.inventory_items
      set custodian = coalesce(p_to_custodian, custodian),
          location = coalesce(p_to_location, location),
          status = v_new_status,
          values = v_values,
          updated_at = now()
    where id = p_item_id;

  elsif p_event_type = 'return' then
    v_new_status := 'Operativo';
    v_values := jsonb_set(v_values, '{Estado}', to_jsonb(v_new_status), true);
    v_values := v_values - 'Custodio';
    update public.inventory_items
      set custodian = null,
          status = v_new_status,
          location = coalesce(p_to_location, location),
          values = v_values,
          updated_at = now()
    where id = p_item_id;

  elsif p_event_type = 'transfer' then
    if p_to_location is not null then
      v_values := jsonb_set(v_values, '{Ubicación}', to_jsonb(p_to_location), true);
    end if;
    if p_to_custodian is not null then
      v_values := jsonb_set(v_values, '{Custodio}', to_jsonb(p_to_custodian), true);
    end if;
    update public.inventory_items
      set location = coalesce(p_to_location, location),
          custodian = coalesce(p_to_custodian, custodian),
          values = v_values,
          updated_at = now()
    where id = p_item_id;

  elsif p_event_type = 'maintenance' then
    v_new_status := 'En reparación';
    v_values := jsonb_set(v_values, '{Estado}', to_jsonb(v_new_status), true);
    update public.inventory_items
      set status = v_new_status, values = v_values, updated_at = now()
    where id = p_item_id;

  elsif p_event_type = 'dispose' then
    v_new_status := 'Baja';
    v_values := jsonb_set(v_values, '{Estado}', to_jsonb(v_new_status), true);
    update public.inventory_items
      set status = v_new_status, values = v_values, updated_at = now()
    where id = p_item_id;

  elsif p_event_type = 'intake' then
    v_new_status := coalesce(v_item.status, 'Operativo');
    v_values := jsonb_set(v_values, '{Estado}', to_jsonb(v_new_status), true);
    update public.inventory_items
      set status = v_new_status,
          location = coalesce(p_to_location, location),
          custodian = coalesce(p_to_custodian, custodian),
          values = v_values,
          updated_at = now()
    where id = p_item_id;
  end if;

  return jsonb_build_object('event_id', v_event_id, 'item_id', p_item_id, 'event_type', p_event_type);
end;
$$;

-- Conteo simple de área stock-like: counted vs sistema → adjust_inventory_item_qty
create or replace function public.count_inventory_item(
  p_item_id bigint,
  p_counted_qty numeric,
  p_reason text default 'Conteo físico'
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_business uuid := public.get_current_business_id();
  v_item public.inventory_items%rowtype;
  v_delta numeric;
begin
  if not public.has_permission_secure(v_business, 'inventory.edit') then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  select * into v_item from public.inventory_items where id = p_item_id and user_id = v_business;
  if not found then
    raise exception 'Ítem no encontrado' using errcode = 'P0002';
  end if;
  if p_counted_qty is null or p_counted_qty < 0 then
    raise exception 'Cantidad contada inválida' using errcode = '22023';
  end if;

  v_delta := p_counted_qty - coalesce(v_item.qty, 0);
  if v_delta = 0 then
    return jsonb_build_object('ok', true, 'diff', 0, 'message', 'Sin diferencia');
  end if;

  return public.adjust_inventory_item_qty(
    p_item_id,
    v_delta,
    coalesce(nullif(trim(p_reason), ''), 'Conteo físico')
      || format(' (sistema=%s físico=%s)', coalesce(v_item.qty, 0), p_counted_qty)
  ) || jsonb_build_object('diff', v_delta);
end;
$$;

revoke all on function public.count_inventory_item(bigint, numeric, text) from public;
grant execute on function public.count_inventory_item(bigint, numeric, text) to authenticated;
