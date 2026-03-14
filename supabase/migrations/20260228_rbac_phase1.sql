-- Phase 1: RBAC Database Structure

-- 1. Create permissions table (Global Catalog)
create table if not exists public.permissions (
  id uuid default gen_random_uuid() primary key,
  code text not null unique,
  module text not null,
  description text,
  created_at timestamptz default now()
);

-- Enable RLS (Read-only for authenticated users)
alter table public.permissions enable row level security;
create policy "Authenticated users can read permissions" on public.permissions for select using (auth.role() = 'authenticated');


-- 2. Create roles table
create table if not exists public.roles (
  id uuid default gen_random_uuid() primary key,
  owner_id uuid references auth.users(id) on delete cascade, -- NULL for system roles
  name text not null,
  description text,
  is_system boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable RLS
alter table public.roles enable row level security;

-- Policy: System roles are visible to everyone
create policy "Everyone can see system roles" on public.roles 
for select using (is_system = true);

-- Policy: Users can see their own custom roles
create policy "Users can see own roles" on public.roles 
for select using (auth.uid() = owner_id);

-- Policy: Users can manage their own roles
create policy "Users can manage own roles" on public.roles 
for all using (auth.uid() = owner_id);


-- 3. Create role_permissions junction table
create table if not exists public.role_permissions (
  role_id uuid references public.roles(id) on delete cascade,
  permission_id uuid references public.permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);

-- Enable RLS
alter table public.role_permissions enable row level security;

-- Policy: Read access if you can see the role
create policy "Read role permissions" on public.role_permissions 
for select using (
  exists (
    select 1 from public.roles r 
    where r.id = role_permissions.role_id 
    and (r.is_system = true or r.owner_id = auth.uid())
  )
);

-- Policy: Manage permissions for own roles
create policy "Manage own role permissions" on public.role_permissions 
for all using (
  exists (
    select 1 from public.roles r 
    where r.id = role_permissions.role_id 
    and r.owner_id = auth.uid()
  )
);


-- 4. Populate Permissions
insert into public.permissions (code, module, description) values
  -- Dashboard
  ('dashboard.view', 'Dashboard', 'Ver panel principal y estadísticas'),
  
  -- Finanzas
  ('finanzas.view', 'Finanzas', 'Ver listados y reportes financieros'),
  ('finanzas.create', 'Finanzas', 'Crear transacciones'),
  ('finanzas.edit', 'Finanzas', 'Editar transacciones existentes'),
  ('finanzas.delete', 'Finanzas', 'Eliminar transacciones'),
  ('finanzas.export', 'Finanzas', 'Exportar data financiera'),
  
  -- Inventario / Almacén
  ('inventory.view', 'Inventario', 'Ver productos y stock'),
  ('inventory.create', 'Inventario', 'Crear productos'),
  ('inventory.edit', 'Inventario', 'Editar productos'),
  ('inventory.delete', 'Inventario', 'Eliminar productos'),
  ('inventory.move', 'Inventario', 'Registrar entradas/salidas'),
  
  -- Configuración
  ('config.view', 'Configuración', 'Ver configuración del negocio'),
  ('config.edit', 'Configuración', 'Editar configuración (monedas, balances)'),
  ('team.manage', 'Configuración', 'Invitar/Eliminar socios y gestionar roles'),
  
  -- Logs
  ('logs.view', 'Logs', 'Ver logs de auditoría')
on conflict (code) do nothing;


-- 5. Create System Default Roles
do $$
declare
  admin_role_id uuid;
  viewer_role_id uuid;
  editor_role_id uuid;
begin
  -- 5.1 "Administrador Limitado" (Legacy 'admin')
  -- Has access to almost everything except critical config edits/logs
  insert into public.roles (name, description, is_system)
  values ('Administrador Limitado', 'Acceso a gestión completa excepto logs y configuración sensible', true)
  returning id into admin_role_id;

  -- Assign permissions
  insert into public.role_permissions (role_id, permission_id)
  select admin_role_id, id from public.permissions 
  where code in (
    'dashboard.view',
    'finanzas.view', 'finanzas.create', 'finanzas.edit', 'finanzas.delete', 'finanzas.export',
    'inventory.view', 'inventory.create', 'inventory.edit', 'inventory.delete', 'inventory.move',
    'config.view', 'team.manage'
  );

  -- 5.2 "Editor" (Legacy 'editor')
  -- Operational role: Can work but not configure or delete critical things
  insert into public.roles (name, description, is_system)
  values ('Editor', 'Puede crear y editar registros en Finanzas e Inventario', true)
  returning id into editor_role_id;

  insert into public.role_permissions (role_id, permission_id)
  select editor_role_id, id from public.permissions 
  where code in (
    'dashboard.view',
    'finanzas.view', 'finanzas.create', 'finanzas.edit',
    'inventory.view', 'inventory.create', 'inventory.edit', 'inventory.move'
  );

  -- 5.3 "Visualizador" (Legacy 'viewer')
  -- Read-only access
  insert into public.roles (name, description, is_system)
  values ('Visualizador', 'Solo lectura de datos, sin permisos de modificación', true)
  returning id into viewer_role_id;

  insert into public.role_permissions (role_id, permission_id)
  select viewer_role_id, id from public.permissions 
  where code like '%.view';

end $$;


-- 6. Update team_members table
-- Add role_id column
alter table public.team_members 
add column if not exists role_id uuid references public.roles(id);

-- 7. Migrate existing data
do $$
declare
  r_admin_id uuid;
  r_editor_id uuid;
  r_viewer_id uuid;
begin
  select id into r_admin_id from public.roles where name = 'Administrador Limitado' and is_system = true limit 1;
  select id into r_editor_id from public.roles where name = 'Editor' and is_system = true limit 1;
  select id into r_viewer_id from public.roles where name = 'Visualizador' and is_system = true limit 1;

  -- Migrate 'admin' -> Administrador Limitado
  update public.team_members set role_id = r_admin_id where role = 'admin' and role_id is null;
  
  -- Migrate 'editor' -> Editor
  update public.team_members set role_id = r_editor_id where role = 'editor' and role_id is null;
  
  -- Migrate 'viewer' -> Visualizador
  update public.team_members set role_id = r_viewer_id where role = 'viewer' and role_id is null;

  -- Fallback for unknown roles (default to Viewer for safety)
  update public.team_members set role_id = r_viewer_id where role_id is null;
end $$;

-- Make role_id mandatory (after migration)
-- alter table public.team_members alter column role_id set not null; 
-- We keep it optional for now just in case, but application logic should enforce it.
-- Or we can rename old column to legacy

alter table public.team_members rename column role to role_legacy;
alter table public.team_members alter column role_legacy drop not null;
