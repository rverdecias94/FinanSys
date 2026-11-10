-- ============================================================================
-- PAGOS PREMIUM · Fase 6 — Restaurar listado admin de subcuentas
-- ============================================================================
-- 20260621 lo eliminó asumiendo gestión solo en cuentas premium; el plan Fase 6
-- exige pestaña Equipo global en /admin/planes.
-- ============================================================================

create or replace function public.admin_list_team_members(
  p_business_id uuid default null,
  p_search text default null,
  p_status text default null,
  p_page integer default 1,
  p_page_size integer default 10
)
returns json
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
set row_security = off
as $$
declare
  v_from integer;
  v_size integer;
  v_result json;
begin
  if not public.is_system_admin() then
    raise exception 'Solo un administrador del sistema' using errcode = 'P0001';
  end if;
  v_size := coalesce(p_page_size, 10);
  v_from := greatest(0, (coalesce(p_page, 1) - 1) * v_size);

  with base as (
    select tm.id as team_member_id,
           tm.member_id,
           tm.member_email,
           tm.owner_id as business_id,
           ou.email as owner_email,
           coalesce(r.name, tm.role_legacy) as role,
           tm.status as membership_status,
           coalesce(acc.status, 'active') as account_status,
           tm.created_at
    from public.team_members tm
    left join public.roles r on r.id = tm.role_id
    left join auth.users ou on ou.id = tm.owner_id
    left join public.account_status acc on acc.user_id = tm.member_id
    where (p_business_id is null or tm.owner_id = p_business_id)
      and tm.status in ('active', 'pending', 'revoked')
  ),
  filtered as (
    select * from base
    where (p_search is null or p_search = ''
           or member_email ilike '%' || p_search || '%'
           or owner_email ilike '%' || p_search || '%')
      and (p_status is null or p_status = '' or p_status = 'all' or account_status = p_status)
  )
  select json_build_object(
    'rows', coalesce((select json_agg(pg) from (
       select * from filtered order by created_at desc offset v_from limit v_size) pg), '[]'::json),
    'total', (select count(*) from filtered)
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.admin_list_team_members(uuid, text, text, integer, integer) from public, anon;
grant execute on function public.admin_list_team_members(uuid, text, text, integer, integer) to authenticated;
