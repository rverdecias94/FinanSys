-- 20260622_s3_balance_trigger_to_business_balances.sql
-- S3 (Q12) — Saldo atómico y multimoneda correcto.
--
-- PROBLEMA (verificado en prod): el trigger `on_transaction_balance_update`
-- mantenía la tabla LEGADA `configuracion_balance` (solo columnas USD/CUP, 0 filas,
-- ya no la lee la app), mientras la app lee `business_balances` (saldo por moneda),
-- que solo se recalculaba al guardar la configuración. Resultado: el saldo mostrado
-- quedaba DESACTUALIZADO. Ejemplos reales medidos antes de esta migración:
--   USD dueño: guardado 1100, real (1000 + 370 - 145) = 1225
--   CUP dueño: guardado 246135, real (285500 + 18000 - 67365) = 236135
--
-- SOLUCIÓN: el trigger ahora mantiene `business_balances.current_balance` por
-- (user_id, currency_code) EN LA MISMA TRANSACCIÓN que la operación sobre
-- `transactions`. Es atómico => correcto ante usuarios concurrentes (cierra Q12),
-- y funciona para CUALQUIER moneda. Un reseed único corrige los saldos ya desfasados.
--
-- Seguridad: SECURITY DEFINER + search_path fijo (patrón del proyecto). El trigger
-- escribe una tabla derivada del sistema; no requiere la RLS del usuario.
-- Idempotente: CREATE OR REPLACE + reseed recalculado desde `transactions`.
-- Reversible: ver bloque ROLLBACK al final.
-- No duplica: createTransaction/updateTransaction NO escriben business_balances;
-- updateBalanceConfig hace un SET absoluto (recompute), no un incremento.

create or replace function public.handle_transaction_balance_update()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_old numeric;
  v_new numeric;
begin
  -- INSERT: aplica el efecto de la nueva transacción
  if (tg_op = 'INSERT') then
    v_new := case when new.type = 'income' then new.amount else -new.amount end;
    insert into public.business_balances as b (user_id, currency_code, initial_balance, current_balance, last_updated)
    values (new.user_id, new.currency, 0, v_new, now())
    on conflict (user_id, currency_code)
    do update set current_balance = b.current_balance + v_new, last_updated = now();
    return new;

  -- DELETE: revierte el efecto de la transacción borrada
  elsif (tg_op = 'DELETE') then
    v_old := case when old.type = 'income' then old.amount else -old.amount end;
    insert into public.business_balances as b (user_id, currency_code, initial_balance, current_balance, last_updated)
    values (old.user_id, old.currency, 0, -v_old, now())
    on conflict (user_id, currency_code)
    do update set current_balance = b.current_balance - v_old, last_updated = now();
    return old;

  -- UPDATE: revierte el efecto viejo y aplica el nuevo. Cubre cambios de monto,
  -- de tipo (income/expense) Y de moneda (ajusta ambas filas si la moneda cambia).
  elsif (tg_op = 'UPDATE') then
    v_old := case when old.type = 'income' then old.amount else -old.amount end;
    v_new := case when new.type = 'income' then new.amount else -new.amount end;

    insert into public.business_balances as b (user_id, currency_code, initial_balance, current_balance, last_updated)
    values (old.user_id, old.currency, 0, -v_old, now())
    on conflict (user_id, currency_code)
    do update set current_balance = b.current_balance - v_old, last_updated = now();

    insert into public.business_balances as b (user_id, currency_code, initial_balance, current_balance, last_updated)
    values (new.user_id, new.currency, 0, v_new, now())
    on conflict (user_id, currency_code)
    do update set current_balance = b.current_balance + v_new, last_updated = now();
    return new;
  end if;

  return null;
end;
$$;

-- Reseed único (idempotente):
-- 1) garantiza una fila por cada (user_id, moneda) que tenga transacciones,
insert into public.business_balances (user_id, currency_code, initial_balance, current_balance, last_updated)
select t.user_id, t.currency, 0, 0, now()
from public.transactions t
where not exists (
  select 1 from public.business_balances b
  where b.user_id = t.user_id and b.currency_code = t.currency
)
group by t.user_id, t.currency
on conflict (user_id, currency_code) do nothing;

-- 2) recalcula current_balance = initial_balance + Σingresos - Σgastos por moneda.
update public.business_balances b
set current_balance = coalesce(b.initial_balance, 0) + coalesce((
      select sum(case when t.type = 'income' then t.amount else -t.amount end)
      from public.transactions t
      where t.user_id = b.user_id and t.currency = b.currency_code
    ), 0),
    last_updated = now();

-- ============================================================================
-- ROLLBACK (manual): restaurar el cuerpo anterior del trigger (escribía en
-- configuracion_balance, solo USD/CUP). El reseed NO se revierte: deja
-- business_balances correcto, que es el estado deseado.
--
--   create or replace function public.handle_transaction_balance_update()
--   returns trigger language plpgsql security definer
--   set search_path to 'public', 'pg_temp' as $$
--   begin
--     -- (versión legacy: upsert configuracion_balance con balance_total_usd/cup)
--     -- ver historial git de esta migración para el cuerpo exacto.
--     return null;
--   end; $$;
-- ============================================================================
