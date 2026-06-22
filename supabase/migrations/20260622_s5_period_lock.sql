-- 20260622_s5_period_lock.sql
-- S5 (Q17) — Cierre de período (bloqueo de fechas pasadas) con reapertura trazable.
--
-- Modelo: una fecha de cierre por negocio (period_locks.closed_through). Todo movimiento
-- con date <= closed_through está en período CERRADO.
--
-- Guard (BEFORE INSERT/UPDATE/DELETE en transactions), defensa en profundidad (no se
-- puede saltar por API):
--   INSERT: bloquea si la fecha cae en período cerrado.
--   DELETE: bloquea si el movimiento es de período cerrado.
--   UPDATE: bloquea solo si cambia la SUSTANCIA (fecha/monto/tipo/moneda) de un movimiento
--           del período cerrado, o si se mueve una fecha hacia el período cerrado. Los
--           COBROS/PAGOS (cambios de paid_amount/status/due_date) SIGUEN PERMITIDOS: cobrar
--           hoy una cuenta vieja no altera el pasado.
--
-- set_period_lock(p_through): cierra (o reabre con p_through NULL); registra en audit_logs
-- el cambio (old->new) con acción 'Cerrar período'/'Reabrir período' => reapertura trazable.
-- Requiere config.edit. Idempotente / reversible (ver ROLLBACK).

create table if not exists public.period_locks (
  user_id        uuid primary key default get_current_business_id() references auth.users(id) on delete cascade,
  closed_through date not null,
  updated_by     uuid,
  updated_at     timestamptz not null default now()
);

alter table public.period_locks enable row level security;

-- Lectura por el negocio (la usa el modal y Configuración). Escritura SOLO vía RPC definer.
drop policy if exists period_locks_read on public.period_locks;
create policy period_locks_read on public.period_locks
  for select using (has_permission_secure(user_id, 'finanzas.view'));

create or replace function public.enforce_period_lock()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_lock date;
  v_business uuid;
begin
  v_business := coalesce(new.user_id, old.user_id);
  select closed_through into v_lock from public.period_locks where user_id = v_business;
  if v_lock is null then
    return coalesce(new, old);
  end if;

  if (tg_op = 'INSERT') then
    if new.date::date <= v_lock then
      raise exception 'Período cerrado hasta %. No puedes registrar movimientos con esa fecha.', to_char(v_lock, 'DD/MM/YYYY') using errcode = 'P0010';
    end if;
  elsif (tg_op = 'DELETE') then
    if old.date::date <= v_lock then
      raise exception 'Período cerrado hasta %. No puedes eliminar movimientos de ese período.', to_char(v_lock, 'DD/MM/YYYY') using errcode = 'P0010';
    end if;
  elsif (tg_op = 'UPDATE') then
    if ( (old.date::date <= v_lock) or (new.date::date <= v_lock) )
       and ( old.date     is distinct from new.date
          or old.amount   is distinct from new.amount
          or old.type     is distinct from new.type
          or old.currency is distinct from new.currency ) then
      raise exception 'Período cerrado hasta %. No puedes editar la fecha/monto/tipo/moneda de un movimiento de ese período.', to_char(v_lock, 'DD/MM/YYYY') using errcode = 'P0010';
    end if;
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_period_lock on public.transactions;
create trigger trg_period_lock
  before insert or update or delete on public.transactions
  for each row execute function public.enforce_period_lock();

create or replace function public.set_period_lock(p_through date)
returns date
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_business uuid := public.get_current_business_id();
  v_actor uuid := auth.uid();
  v_old date;
  v_email text;
begin
  if not public.has_permission_secure(v_business, 'config.edit') then
    raise exception 'No autorizado: requiere permiso config.edit' using errcode = '42501';
  end if;

  select closed_through into v_old from public.period_locks where user_id = v_business;

  if p_through is null then
    delete from public.period_locks where user_id = v_business;
  else
    insert into public.period_locks (user_id, closed_through, updated_by, updated_at)
    values (v_business, p_through, v_actor, now())
    on conflict (user_id) do update
      set closed_through = excluded.closed_through, updated_by = excluded.updated_by, updated_at = now();
  end if;

  begin  -- auditoría trazable (cierre/reapertura); nunca rompe la operación
    select email into v_email from auth.users where id = v_actor;
    insert into public.audit_logs (business_id, actor_id, user_id, user_email, action, resource, area, old_value, new_value, details)
    values (
      v_business, v_actor, v_actor, v_email,
      case when p_through is null then 'Reabrir período'
           when v_old is null or p_through > v_old then 'Cerrar período'
           else 'Reabrir período' end,
      'Cierre contable', 'Configuración',
      jsonb_build_object('closed_through', v_old),
      jsonb_build_object('closed_through', p_through),
      '{}'::jsonb
    );
  exception when others then null;
  end;

  return p_through;
end;
$$;

revoke all on function public.set_period_lock(date) from public, anon;
grant execute on function public.set_period_lock(date) to authenticated;

-- ============================================================================
-- ROLLBACK (manual):
--   drop trigger if exists trg_period_lock on public.transactions;
--   drop function if exists public.enforce_period_lock();
--   drop function if exists public.set_period_lock(date);
--   drop table if exists public.period_locks;
-- ============================================================================
