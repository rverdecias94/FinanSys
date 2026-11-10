-- ============================================================================
-- P0-005 — business_balances = caja cobrada (settled), no devengado
-- ============================================================================
-- Antes: el trigger sumaba `amount` al crear la tx (incluye CxC/CxP pending).
-- Ahora usa `paid_amount`. Los abonos (UPDATE de paid_amount) mueven la caja
-- automáticamente. Reseed de saldos actuales a partir de paid_amount.
-- ============================================================================

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
  if (tg_op = 'INSERT') then
    v_new := case
      when new.type = 'income' then coalesce(new.paid_amount, 0)
      else -coalesce(new.paid_amount, 0)
    end;
    if v_new <> 0 then
      insert into public.business_balances as b (user_id, currency_code, initial_balance, current_balance, last_updated)
      values (new.user_id, new.currency, 0, v_new, now())
      on conflict (user_id, currency_code)
      do update set current_balance = b.current_balance + v_new, last_updated = now();
    end if;
    return new;

  elsif (tg_op = 'DELETE') then
    v_old := case
      when old.type = 'income' then coalesce(old.paid_amount, 0)
      else -coalesce(old.paid_amount, 0)
    end;
    if v_old <> 0 then
      insert into public.business_balances as b (user_id, currency_code, initial_balance, current_balance, last_updated)
      values (old.user_id, old.currency, 0, -v_old, now())
      on conflict (user_id, currency_code)
      do update set current_balance = b.current_balance - v_old, last_updated = now();
    end if;
    return old;

  elsif (tg_op = 'UPDATE') then
    v_old := case
      when old.type = 'income' then coalesce(old.paid_amount, 0)
      else -coalesce(old.paid_amount, 0)
    end;
    v_new := case
      when new.type = 'income' then coalesce(new.paid_amount, 0)
      else -coalesce(new.paid_amount, 0)
    end;

    if v_old <> 0 then
      insert into public.business_balances as b (user_id, currency_code, initial_balance, current_balance, last_updated)
      values (old.user_id, old.currency, 0, -v_old, now())
      on conflict (user_id, currency_code)
      do update set current_balance = b.current_balance - v_old, last_updated = now();
    end if;

    if v_new <> 0 then
      insert into public.business_balances as b (user_id, currency_code, initial_balance, current_balance, last_updated)
      values (new.user_id, new.currency, 0, v_new, now())
      on conflict (user_id, currency_code)
      do update set current_balance = b.current_balance + v_new, last_updated = now();
    end if;
    return new;
  end if;

  return null;
end;
$$;

-- Reseed: current_balance = initial + suma signed de paid_amount
insert into public.business_balances (user_id, currency_code, initial_balance, current_balance, last_updated)
select
  t.user_id,
  t.currency,
  0,
  sum(case when t.type = 'income' then coalesce(t.paid_amount, 0) else -coalesce(t.paid_amount, 0) end),
  now()
from public.transactions t
group by t.user_id, t.currency
on conflict (user_id, currency_code) do nothing;

update public.business_balances b
set current_balance = coalesce(b.initial_balance, 0) + coalesce((
  select sum(
    case
      when t.type = 'income' then coalesce(t.paid_amount, 0)
      else -coalesce(t.paid_amount, 0)
    end
  )
  from public.transactions t
  where t.user_id = b.user_id
    and t.currency = b.currency_code
), 0),
last_updated = now();
