-- Inventario F1 — Tipología de área, plantillas y campos semánticos
-- ----------------------------------------------------------------------------

alter table public.inventory_areas
  add column if not exists domain_type text not null default 'custom';

alter table public.inventory_areas
  drop constraint if exists inventory_areas_domain_type_check;

alter table public.inventory_areas
  add constraint inventory_areas_domain_type_check
  check (domain_type in ('merchandise','supplies','fixed_asset','tool','custom'));

alter table public.inventory_areas
  add column if not exists template_id text;

alter table public.inventory_area_fields
  add column if not exists origin text not null default 'custom';

alter table public.inventory_area_fields
  drop constraint if exists inventory_area_fields_origin_check;

alter table public.inventory_area_fields
  add constraint inventory_area_fields_origin_check
  check (origin in ('system','template','custom'));

alter table public.inventory_area_fields
  add column if not exists semantic text;

-- Ampliar tipos de campo (drop check auto-generado si existe)
do $$
declare
  v_con text;
begin
  select c.conname into v_con
  from pg_constraint c
  join pg_class t on t.oid = c.conrelid
  where t.relname = 'inventory_area_fields'
    and c.contype = 'c'
    and pg_get_constraintdef(c.oid) ilike '%type%';
  if v_con is not null then
    execute format('alter table public.inventory_area_fields drop constraint %I', v_con);
  end if;
end $$;

alter table public.inventory_area_fields
  add constraint inventory_area_fields_type_check
  check (type in (
    'text','number','select','color','date','boolean','textarea',
    'quantity_uom','currency','barcode','serial','person_text','location_text','photo_url'
  ));

-- Backfill (idempotente)
update public.inventory_areas set domain_type = 'custom' where domain_type is null;
update public.inventory_area_fields set origin = 'custom' where origin is null;

-- Catálogo de plantillas en servidor (para apply_inventory_template)
create or replace function public.apply_inventory_template(p_area_id bigint, p_template_id text)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_business uuid := public.get_current_business_id();
  v_area public.inventory_areas%rowtype;
  v_domain text;
  v_fields jsonb;
  v_field jsonb;
  v_order int := 0;
  v_inserted int := 0;
  v_name text;
  v_type text;
  v_required boolean;
  v_semantic text;
  v_origin text;
  v_options jsonb;
  v_label text;
begin
  if not public.has_permission_secure(v_business, 'inventory.edit') then
    raise exception 'No autorizado: requiere inventory.edit' using errcode = '42501';
  end if;

  select * into v_area from public.inventory_areas
  where id = p_area_id and user_id = v_business for update;
  if not found then
    raise exception 'Área no encontrada' using errcode = 'P0002';
  end if;
  if coalesce(v_area.plan_locked, false) then
    raise exception 'Área bloqueada por tu plan' using errcode = '53400';
  end if;

  v_domain := case p_template_id
    when 'merchandise_basic' then 'merchandise'
    when 'supplies' then 'supplies'
    when 'assets_equipment' then 'fixed_asset'
    when 'tools' then 'tool'
    when 'custom_blank' then 'custom'
    else null
  end;
  if v_domain is null then
    raise exception 'Plantilla desconocida: %', p_template_id using errcode = '22023';
  end if;

  v_fields := case p_template_id
    when 'merchandise_basic' then '[
      {"name":"Nombre","type":"text","required":true,"origin":"system","semantic":"name"},
      {"name":"Cantidad","type":"quantity_uom","required":true,"origin":"system","semantic":"quantity"},
      {"name":"Ubicación","type":"location_text","required":false,"origin":"template","semantic":"location"},
      {"name":"Mínimo","type":"number","required":false,"origin":"template","semantic":"min_qty"},
      {"name":"Vence","type":"date","required":false,"origin":"template","semantic":"date_expiry"}
    ]'::jsonb
    when 'supplies' then '[
      {"name":"Nombre","type":"text","required":true,"origin":"system","semantic":"name"},
      {"name":"Cantidad","type":"quantity_uom","required":true,"origin":"system","semantic":"quantity"},
      {"name":"Unidad","type":"select","required":false,"origin":"template","semantic":"uom","options":["unidades","kg","litros","paquetes"]},
      {"name":"Ubicación","type":"location_text","required":false,"origin":"template","semantic":"location"}
    ]'::jsonb
    when 'assets_equipment' then '[
      {"name":"Nombre","type":"text","required":true,"origin":"system","semantic":"name"},
      {"name":"Serie","type":"serial","required":false,"origin":"template","semantic":"serial"},
      {"name":"Ubicación","type":"location_text","required":true,"origin":"system","semantic":"location"},
      {"name":"Custodio","type":"person_text","required":false,"origin":"template","semantic":"custodian"},
      {"name":"Estado","type":"select","required":true,"origin":"system","semantic":"status","options":["Operativo","En reparación","Asignado","Baja"]},
      {"name":"Fecha adquisición","type":"date","required":false,"origin":"template","semantic":"date_acquired"},
      {"name":"Coste","type":"currency","required":false,"origin":"template","semantic":"currency"},
      {"name":"Notas","type":"textarea","required":false,"origin":"template","semantic":null},
      {"name":"Foto","type":"photo_url","required":false,"origin":"template","semantic":null}
    ]'::jsonb
    when 'tools' then '[
      {"name":"Nombre","type":"text","required":true,"origin":"system","semantic":"name"},
      {"name":"Serie","type":"serial","required":false,"origin":"template","semantic":"serial"},
      {"name":"Custodio","type":"person_text","required":false,"origin":"template","semantic":"custodian"},
      {"name":"Estado","type":"select","required":true,"origin":"system","semantic":"status","options":["Operativo","En reparación","Asignado","Baja"]},
      {"name":"Ubicación","type":"location_text","required":false,"origin":"template","semantic":"location"}
    ]'::jsonb
    else '[]'::jsonb
  end;

  update public.inventory_areas
    set domain_type = v_domain, template_id = p_template_id
  where id = p_area_id;

  for v_field in select * from jsonb_array_elements(v_fields)
  loop
    v_name := v_field->>'name';
    v_type := v_field->>'type';
    v_required := coalesce((v_field->>'required')::boolean, false);
    v_semantic := nullif(v_field->>'semantic', '');
    v_origin := coalesce(v_field->>'origin', 'template');
    v_options := case when v_field ? 'options' then v_field->'options' else null end;
    v_label := initcap(v_name);

    if exists (
      select 1 from public.inventory_area_fields f
      where f.area_id = p_area_id and f.user_id = v_business and lower(f.name) = lower(v_name)
    ) then
      continue;
    end if;

    insert into public.inventory_area_fields (
      user_id, area_id, name, label, type, required, options, "order", origin, semantic
    ) values (
      v_business, p_area_id, v_name, v_label, v_type, v_required, v_options, v_order, v_origin, v_semantic
    );
    v_order := v_order + 1;
    v_inserted := v_inserted + 1;
  end loop;

  return jsonb_build_object(
    'area_id', p_area_id,
    'template_id', p_template_id,
    'domain_type', v_domain,
    'fields_inserted', v_inserted
  );
end;
$$;

revoke all on function public.apply_inventory_template(bigint, text) from public;
grant execute on function public.apply_inventory_template(bigint, text) to authenticated;
