create table if not exists public.profiles (
  id uuid primary key,
  role text not null check (role in ('admin','employee')),
  created_at timestamptz default now()
);

create table if not exists public.settings (
  key text primary key,
  value text not null
);

create table if not exists public.products (
  id bigserial primary key,
  name text not null,
  category text not null,
  unit_price numeric(12,2) not null default 0,
  stock integer not null default 0
);

create table if not exists public.movements (
  id bigserial primary key,
  product_id bigint not null references public.products(id) on delete cascade,
  date timestamptz not null default now(),
  qty integer not null,
  type text not null check (type in ('in','out')),
  user_id uuid
);

create table if not exists public.transactions (
  id bigserial primary key,
  user_id uuid not null,
  date timestamptz not null default now(),
  amount numeric(14,2) not null,
  currency text not null check (currency in ('USD','CUP')),
  category text not null,
  description text,
  type text not null check (type in ('income','expense'))
);

create or replace function public.apply_movement_update_stock()
returns trigger
language plpgsql
as $$
begin
  if new.type = 'in' then
    update public.products set stock = stock + new.qty where id = new.product_id;
  else
    update public.products set stock = stock - new.qty where id = new.product_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_movements_update_stock on public.movements;
create trigger trg_movements_update_stock
after insert on public.movements
for each row execute function public.apply_movement_update_stock();

alter table public.profiles enable row level security;
alter table public.settings enable row level security;
alter table public.products enable row level security;
alter table public.movements enable row level security;
alter table public.transactions enable row level security;

create policy profiles_select_own on public.profiles
for select
to authenticated
using (id = auth.uid());

create policy profiles_admin_select on public.profiles
for select
to authenticated
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy profiles_admin_update on public.profiles
for update
to authenticated
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy settings_read_all on public.settings
for select
to authenticated
using (true);

create policy settings_admin_write on public.settings
for insert
to authenticated
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy settings_admin_update on public.settings
for update
to authenticated
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy products_read_all on public.products
for select
to authenticated
using (true);

create policy products_admin_write on public.products
for insert
to authenticated
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy products_admin_update on public.products
for update
to authenticated
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy movements_read_own on public.movements
for select
to authenticated
using (user_id = auth.uid());

create policy movements_insert_own on public.movements
for insert
to authenticated
with check (user_id = auth.uid());

create policy transactions_read_own on public.transactions
for select
to authenticated
using (user_id = auth.uid());

create policy transactions_insert_own on public.transactions
for insert
to authenticated
with check (user_id = auth.uid());
