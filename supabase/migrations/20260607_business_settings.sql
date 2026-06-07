-- Business Settings (Perfil de la Empresa + Formatos y Región + preferencia de valoración)

create table if not exists public.business_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  company jsonb not null default '{}'::jsonb,
  region jsonb not null default '{}'::jsonb,
  valuation_method text not null default 'fifo',
  updated_at timestamptz not null default now()
);

alter table public.business_settings enable row level security;

drop policy if exists "Owner and Team can view business_settings" on public.business_settings;
create policy "Owner and Team can view business_settings"
on public.business_settings
for select
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.team_members tm
    where tm.member_id = auth.uid()
      and tm.owner_id = business_settings.user_id
      and tm.status = 'active'
  )
);

drop policy if exists "Owners can insert business_settings" on public.business_settings;
create policy "Owners can insert business_settings"
on public.business_settings
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "Owners can update business_settings" on public.business_settings;
create policy "Owners can update business_settings"
on public.business_settings
for update
to authenticated
using (user_id = auth.uid());

drop policy if exists "Owners can delete business_settings" on public.business_settings;
create policy "Owners can delete business_settings"
on public.business_settings
for delete
to authenticated
using (user_id = auth.uid());

create or replace function public.touch_business_settings_updated_at()
returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_business_settings_updated_at on public.business_settings;
create trigger trg_business_settings_updated_at
before update on public.business_settings
for each row execute function public.touch_business_settings_updated_at();
