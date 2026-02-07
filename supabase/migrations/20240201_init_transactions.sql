-- Create the transactions table if it doesn't exist (re-running this is safe due to IF NOT EXISTS)
create table if not exists public.transactions (
  id bigserial primary key,
  user_id uuid,
  date timestamptz not null default now(),
  amount numeric(14,2) not null,
  currency text not null check (currency in ('USD','CUP')),
  category text not null,
  description text,
  type text not null check (type in ('income','expense')),
  details jsonb default '{}'::jsonb
);

-- Enable RLS
alter table public.transactions enable row level security;

-- Create policies if they don't exist (dropping first to avoid errors on duplicate)
drop policy if exists transactions_read_own on public.transactions;
create policy transactions_read_own on public.transactions
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists transactions_insert_own on public.transactions;
create policy transactions_insert_own on public.transactions
for insert
to authenticated
with check (user_id = auth.uid());
