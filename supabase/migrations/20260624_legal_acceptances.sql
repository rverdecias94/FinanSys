-- Registro de aceptación de Términos y Política de Privacidad (clickwrap).
-- Tabla APPEND-ONLY: solo se inserta (vía RPC); nadie puede modificar ni borrar.
-- Evidencia mínima (decisión del responsable): user_id, email, versión y fecha de servidor.
create table if not exists public.legal_acceptances (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  email       text,
  version     text not null,
  context     text not null default 'login_gate',
  accepted_at timestamptz not null default now(),
  unique (user_id, version)
);

comment on table public.legal_acceptances is
  'Registro inmutable (append-only) de aceptaciones de Terminos/Privacidad por cuenta y version. Escritura solo via record_legal_acceptance().';

alter table public.legal_acceptances enable row level security;

-- Lectura: el usuario ve sus propias aceptaciones; el admin del sistema, todas.
-- (Sin politicas de INSERT/UPDATE/DELETE: la unica via de escritura es el RPC SECURITY DEFINER.)
drop policy if exists "legal_acceptances_select_own" on public.legal_acceptances;
create policy "legal_acceptances_select_own"
  on public.legal_acceptances for select
  to authenticated
  using (auth.uid() = user_id or public.is_system_admin());

-- RPC: registra la aceptacion sellando fecha y email en el servidor. Idempotente por (user_id, version).
create or replace function public.record_legal_acceptance(p_version text, p_context text default 'login_gate')
returns public.legal_acceptances
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid   uuid := auth.uid();
  v_email text;
  v_row   public.legal_acceptances;
begin
  if v_uid is null then
    raise exception 'No autenticado' using errcode = '28000';
  end if;
  if p_version is null or btrim(p_version) = '' then
    raise exception 'Version requerida' using errcode = '22023';
  end if;

  select u.email into v_email from auth.users u where u.id = v_uid;

  insert into public.legal_acceptances as la (user_id, email, version, context)
  values (v_uid, v_email, p_version, coalesce(nullif(btrim(p_context), ''), 'login_gate'))
  on conflict (user_id, version)
    do update set email = la.email  -- no-op: devuelve la fila existente (idempotente)
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.record_legal_acceptance(text, text) from public, anon;
grant execute on function public.record_legal_acceptance(text, text) to authenticated;
