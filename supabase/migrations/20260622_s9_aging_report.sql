-- 20260622_s9_aging_report.sql
-- S9 (Q10) — Antigüedad de saldos (aging report)
-- ----------------------------------------------------------------------------
-- RPC get_aging_report(p_direction): clasifica las cuentas pendientes
-- (status pending/partial) por antigüedad respecto a HOY, en tramos
--   por vencer (not_due) / 1-30 / 31-60 / 61-90 / +90 días vencidos
-- con saldo = amount - paid_amount, AGREGADO POR MONEDA (nunca se suman
-- monedas distintas). direction 'receivable' = ingresos (CxC, te deben);
-- 'payable' = gastos (CxP, debes).
--
-- Decisiones:
--  * Sin due_date => "por vencer" (no está vencida; no se pactó fecha).
--  * Comparación de fechas en UTC en ambos lados (determinista).
--  * SECURITY DEFINER + get_current_business_id() + has_permission_secure
--    ('finanzas.view') porque bypassa RLS.
--
-- EXPAND · aditivo · idempotente (CREATE OR REPLACE) · read-only (STABLE)
-- · sin consumidores aún => riesgo nulo.
-- ----------------------------------------------------------------------------

create or replace function public.get_aging_report(p_direction text)
returns table (
  currency  text,
  not_due   numeric,
  d_1_30    numeric,
  d_31_60   numeric,
  d_61_90   numeric,
  d_over_90 numeric,
  total     numeric,
  cnt       integer
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_business uuid := get_current_business_id();
  v_type     text;
begin
  if v_business is null then
    raise exception 'No hay negocio en contexto' using errcode = '42501';
  end if;

  v_type := case p_direction
              when 'receivable' then 'income'
              when 'payable'    then 'expense'
              else null
            end;
  if v_type is null then
    raise exception 'Dirección inválida (usa receivable o payable): %', p_direction
      using errcode = '22023';
  end if;

  if not has_permission_secure(v_business, 'finanzas.view') then
    raise exception 'No tienes permiso para ver reportes financieros'
      using errcode = '42501';
  end if;

  return query
  with oa as (
    select
      t.currency as cur,
      (t.amount - t.paid_amount) as saldo,
      case
        when t.due_date is null then -1  -- sin fecha de vencimiento => no vencida
        else (now() at time zone 'UTC')::date - (t.due_date at time zone 'UTC')::date
      end as days_overdue
    from transactions t
    where t.user_id = v_business
      and t.type = v_type
      and t.status in ('pending', 'partial')
      and (t.amount - t.paid_amount) > 0
  )
  select
    oa.cur,
    coalesce(sum(saldo) filter (where days_overdue <= 0), 0)::numeric,
    coalesce(sum(saldo) filter (where days_overdue between 1 and 30), 0)::numeric,
    coalesce(sum(saldo) filter (where days_overdue between 31 and 60), 0)::numeric,
    coalesce(sum(saldo) filter (where days_overdue between 61 and 90), 0)::numeric,
    coalesce(sum(saldo) filter (where days_overdue > 90), 0)::numeric,
    coalesce(sum(saldo), 0)::numeric,
    count(*)::integer
  from oa
  group by oa.cur
  order by oa.cur;
end;
$$;

revoke all on function public.get_aging_report(text) from public;
grant execute on function public.get_aging_report(text) to authenticated;

-- ----------------------------------------------------------------------------
-- ROLLBACK (manual):
--   drop function if exists public.get_aging_report(text);
-- ----------------------------------------------------------------------------
