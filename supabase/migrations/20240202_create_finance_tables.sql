-- Crear tabla de categorías financieras
create table if not exists public.finance_categories (
  id bigserial primary key,
  name text not null unique,
  type text not null check (type in ('income', 'expense')),
  description text,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Crear tabla de métodos de pago
create table if not exists public.payment_methods (
  id bigserial primary key,
  name text not null unique,
  description text,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Crear tabla de cuentas bancarias
create table if not exists public.bank_accounts (
  id bigserial primary key,
  user_id uuid references auth.users(id) on delete cascade,
  account_name text not null,
  account_number text,
  bank_name text,
  account_type text check (account_type in ('checking', 'savings', 'credit')),
  currency text not null default 'USD' check (currency in ('USD', 'CUP')),
  initial_balance numeric(14,2) default 0,
  current_balance numeric(14,2) default 0,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Insertar categorías de ingresos (solo si no existen)
insert into public.finance_categories (name, type, description) values
  ('Ventas', 'income', 'Ingresos por ventas de productos o servicios'),
  ('Servicios Profesionales', 'income', 'Honorarios por servicios profesionales'),
  ('Inversiones', 'income', 'Rendimientos de inversiones'),
  ('Reembolsos', 'income', 'Reembolsos de gastos'),
  ('Consultoría', 'income', 'Ingresos por servicios de consultoría'),
  ('Licencias', 'income', 'Derechos de licencia'),
  ('Dividendos', 'income', 'Dividendos de acciones'),
  ('Alquileres', 'income', 'Ingresos por alquiler de propiedades'),
  ('Comisiones', 'income', 'Comisiones recibidas'),
  ('Subvenciones', 'income', 'Subvenciones y ayudas'),
  ('Intereses', 'income', 'Intereses de depósitos'),
  ('Regalías', 'income', 'Derechos de autor y regalías'),
  ('Venta de Activos', 'income', 'Venta de activos fijos'),
  ('Cursos', 'income', 'Ingresos por cursos y formación')
on conflict (name) do nothing;

-- Insertar categorías de gastos (solo si no existen)
insert into public.finance_categories (name, type, description) values
  ('Servicios', 'expense', 'Servicios públicos y privados'),
  ('Suministros', 'expense', 'Compra de materiales y suministros'),
  ('Transporte', 'expense', 'Gastos de transporte y logística'),
  ('Alimentación', 'expense', 'Gastos de alimentación'),
  ('Tecnología', 'expense', 'Hardware, software y servicios tecnológicos'),
  ('Marketing', 'expense', 'Publicidad y marketing'),
  ('Nómina', 'expense', 'Salarios y beneficios del personal'),
  ('Impuestos', 'expense', 'Impuestos y tasas'),
  ('Mantenimiento', 'expense', 'Mantenimiento y reparaciones'),
  ('Seguros', 'expense', 'Primas de seguros'),
  ('Alquiler', 'expense', 'Alquiler de oficinas y locales'),
  ('Capacitación', 'expense', 'Formación y capacitación del personal'),
  ('Software', 'expense', 'Licencias de software'),
  ('Mobiliario', 'expense', 'Mobiliario y equipamiento')
on conflict (name) do nothing;

-- Insertar métodos de pago (solo si no existen)
insert into public.payment_methods (name, description) values
  ('Efectivo', 'Pagos en efectivo'),
  ('Transferencia Bancaria', 'Transferencias entre cuentas'),
  ('Tarjeta de Débito', 'Pagos con tarjeta de débito'),
  ('Tarjeta de Crédito', 'Pagos con tarjeta de crédito'),
  ('Cheque', 'Pagos con cheque'),
  ('Depósito Bancario', 'Depósitos en cuenta bancaria'),
  ('PayPal', 'Pagos a través de PayPal'),
  ('Zelle', 'Transferencias por Zelle'),
  ('Otro', 'Otros métodos de pago')
on conflict (name) do nothing;

-- Habilitar RLS en las nuevas tablas
alter table public.finance_categories enable row level security;
alter table public.payment_methods enable row level security;
alter table public.bank_accounts enable row level security;

-- Crear políticas de seguridad para finance_categories
create policy finance_categories_read_all on public.finance_categories
for select
to authenticated
using (is_active = true);

-- Crear políticas de seguridad para payment_methods
create policy payment_methods_read_all on public.payment_methods
for select
to authenticated
using (is_active = true);

-- Crear políticas de seguridad para bank_accounts
create policy bank_accounts_read_own on public.bank_accounts
for select
to authenticated
using (user_id = auth.uid());

create policy bank_accounts_insert_own on public.bank_accounts
for insert
to authenticated
with check (user_id = auth.uid());

create policy bank_accounts_update_own on public.bank_accounts
for update
to authenticated
using (user_id = auth.uid());

create policy bank_accounts_delete_own on public.bank_accounts
for delete
to authenticated
using (user_id = auth.uid());
