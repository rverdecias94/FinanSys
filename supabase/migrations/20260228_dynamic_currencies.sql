-- Create table for available currencies (global dictionary)
create table if not exists public.currencies (
  code text primary key,
  name text not null,
  symbol text not null,
  flag_url text -- Can be an emoji or image URL
);

-- Insert default currencies
insert into public.currencies (code, name, symbol, flag_url) values
('USD', 'Dólar Estadounidense', '$', '🇺🇸'),
('CUP', 'Peso Cubano', '$', '🇨🇺'),
('MXN', 'Peso Mexicano', '$', '🇲🇽'),
('EUR', 'Euro', '€', '🇪🇺')
on conflict (code) do nothing;

-- Enable RLS on currencies (public read-only)
alter table public.currencies enable row level security;

create policy currencies_read_all on public.currencies
for select to authenticated using (true);

-- Create table for business selected currencies
create table if not exists public.business_currencies (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  currency_code text not null references public.currencies(code),
  is_default boolean default false,
  is_active boolean default true,
  created_at timestamptz default now(),
  unique(user_id, currency_code)
);

-- Enable RLS on business_currencies
alter table public.business_currencies enable row level security;

create policy business_currencies_select_own on public.business_currencies
for select to authenticated using (user_id = auth.uid());

create policy business_currencies_insert_own on public.business_currencies
for insert to authenticated with check (user_id = auth.uid());

create policy business_currencies_update_own on public.business_currencies
for update to authenticated using (user_id = auth.uid());

create policy business_currencies_delete_own on public.business_currencies
for delete to authenticated using (user_id = auth.uid());

-- Create table for business balances per currency
create table if not exists public.business_balances (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  currency_code text not null references public.currencies(code),
  initial_balance numeric(14,2) default 0,
  current_balance numeric(14,2) default 0, -- Calculated field, but stored for performance/snapshot
  last_updated timestamptz default now(),
  unique(user_id, currency_code)
);

-- Enable RLS on business_balances
alter table public.business_balances enable row level security;

create policy business_balances_select_own on public.business_balances
for select to authenticated using (user_id = auth.uid());

create policy business_balances_insert_own on public.business_balances
for insert to authenticated with check (user_id = auth.uid());

create policy business_balances_update_own on public.business_balances
for update to authenticated using (user_id = auth.uid());

-- Remove check constraint from transactions table
alter table public.transactions drop constraint if exists transactions_currency_check;

-- Optional: Add foreign key constraint to transactions.currency -> currencies.code
-- But existing data might have invalid codes if we are not careful, though check constraint prevented it.
-- We can add it now.
alter table public.transactions 
add constraint transactions_currency_fkey 
foreign key (currency) references public.currencies(code);


-- Migration of existing data from configuracion_balance to business_balances
-- We assume all existing users have USD and CUP enabled by default
do $$
declare
  r record;
begin
  -- For each user in configuracion_balance, create entries in business_currencies and business_balances
  for r in select * from public.configuracion_balance loop
    -- Insert USD currency for business
    insert into public.business_currencies (user_id, currency_code, is_default, is_active)
    values (r.user_id, 'USD', true, true)
    on conflict do nothing;

    -- Insert CUP currency for business
    insert into public.business_currencies (user_id, currency_code, is_default, is_active)
    values (r.user_id, 'CUP', false, true)
    on conflict do nothing;

    -- Insert USD balance
    insert into public.business_balances (user_id, currency_code, initial_balance, current_balance)
    values (r.user_id, 'USD', r.initial_balance_usd, r.balance_total_usd)
    on conflict (user_id, currency_code) 
    do update set initial_balance = excluded.initial_balance, current_balance = excluded.current_balance;

    -- Insert CUP balance
    insert into public.business_balances (user_id, currency_code, initial_balance, current_balance)
    values (r.user_id, 'CUP', r.initial_balance_cup, r.balance_total_cup)
    on conflict (user_id, currency_code) 
    do update set initial_balance = excluded.initial_balance, current_balance = excluded.current_balance;
  end loop;
end $$;
