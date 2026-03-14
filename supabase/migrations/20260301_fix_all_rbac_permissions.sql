-- Comprehensive fix for RBAC permissions, roles data, and RLS policies
-- Run this migration to fix "empty roles list" and "permission denied" errors

-- 1. Ensure RLS is enabled on all RBAC tables
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- 2. Grant permissions to authenticated users and service_role
GRANT USAGE ON SCHEMA public TO authenticated, service_role;

GRANT SELECT ON public.permissions TO authenticated;
GRANT SELECT ON public.role_permissions TO authenticated;
GRANT SELECT ON public.roles TO authenticated;
GRANT ALL ON public.team_members TO authenticated; 

GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

-- 3. Fix Roles Policies
DROP POLICY IF EXISTS "Everyone can see system roles" ON public.roles;
DROP POLICY IF EXISTS "Users can see own roles" ON public.roles;
DROP POLICY IF EXISTS "Users can manage own roles" ON public.roles;

-- Allow viewing system roles
CREATE POLICY "Everyone can see system roles" ON public.roles 
FOR SELECT USING (is_system = true);

-- Allow viewing own custom roles
CREATE POLICY "Users can see own roles" ON public.roles 
FOR SELECT USING (auth.uid() = owner_id);

-- Allow managing own custom roles
CREATE POLICY "Users can manage own roles" ON public.roles 
FOR ALL USING (auth.uid() = owner_id);


-- 4. Fix Team Members Policies (Re-apply to be sure)
DROP POLICY IF EXISTS "Owners can manage their team" ON public.team_members;
DROP POLICY IF EXISTS "Members can view their own membership" ON public.team_members;
DROP POLICY IF EXISTS "Members can view team colleagues" ON public.team_members;

CREATE POLICY "Owners can manage their team"
ON public.team_members
FOR ALL
USING (auth.uid() = owner_id);

CREATE POLICY "Members can view their own membership"
ON public.team_members
FOR SELECT
USING (auth.uid() = member_id);

CREATE POLICY "Members can view team colleagues"
ON public.team_members
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.member_id = auth.uid()
    AND tm.owner_id = team_members.owner_id
    AND tm.status = 'active'
  )
);

-- 5. Ensure Permissions Exist (Idempotent)
INSERT INTO public.permissions (code, module, description) VALUES
  ('dashboard.view', 'Dashboard', 'Ver panel principal y estadísticas'),
  ('finanzas.view', 'Finanzas', 'Ver listados y reportes financieros'),
  ('finanzas.create', 'Finanzas', 'Crear transacciones'),
  ('finanzas.edit', 'Finanzas', 'Editar transacciones existentes'),
  ('finanzas.delete', 'Finanzas', 'Eliminar transacciones'),
  ('finanzas.export', 'Finanzas', 'Exportar data financiera'),
  ('inventory.view', 'Inventario', 'Ver productos y stock'),
  ('inventory.create', 'Inventario', 'Crear productos'),
  ('inventory.edit', 'Inventario', 'Editar productos'),
  ('inventory.delete', 'Inventario', 'Eliminar productos'),
  ('inventory.move', 'Inventario', 'Registrar entradas/salidas'),
  ('config.view', 'Configuración', 'Ver configuración del negocio'),
  ('config.edit', 'Configuración', 'Editar configuración (monedas, balances)'),
  ('team.manage', 'Configuración', 'Invitar/Eliminar socios y gestionar roles'),
  ('logs.view', 'Logs', 'Ver logs de auditoría')
ON CONFLICT (code) DO NOTHING;

-- 6. Ensure System Roles and their Permissions Exist (Idempotent)
DO $$
DECLARE
  admin_role_id uuid;
  viewer_role_id uuid;
  editor_role_id uuid;
BEGIN
  -- 6.1 Administrador Limitado
  SELECT id INTO admin_role_id FROM public.roles WHERE name = 'Administrador Limitado' AND is_system = true LIMIT 1;
  IF admin_role_id IS NULL THEN
    INSERT INTO public.roles (name, description, is_system)
    VALUES ('Administrador Limitado', 'Acceso a gestión completa excepto logs y configuración sensible', true)
    RETURNING id INTO admin_role_id;
  END IF;

  -- Re-assign permissions for Admin (clearing old ones first to be safe or just insert on conflict?)
  -- Simple approach: Insert missing
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT admin_role_id, id FROM public.permissions 
  WHERE code IN (
    'dashboard.view',
    'finanzas.view', 'finanzas.create', 'finanzas.edit', 'finanzas.delete', 'finanzas.export',
    'inventory.view', 'inventory.create', 'inventory.edit', 'inventory.delete', 'inventory.move',
    'config.view', 'team.manage'
  )
  ON CONFLICT DO NOTHING;

  -- 6.2 Editor
  SELECT id INTO editor_role_id FROM public.roles WHERE name = 'Editor' AND is_system = true LIMIT 1;
  IF editor_role_id IS NULL THEN
    INSERT INTO public.roles (name, description, is_system)
    VALUES ('Editor', 'Puede crear y editar registros en Finanzas e Inventario', true)
    RETURNING id INTO editor_role_id;
  END IF;

  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT editor_role_id, id FROM public.permissions 
  WHERE code IN (
    'dashboard.view',
    'finanzas.view', 'finanzas.create', 'finanzas.edit',
    'inventory.view', 'inventory.create', 'inventory.edit', 'inventory.move'
  )
  ON CONFLICT DO NOTHING;

  -- 6.3 Visualizador
  SELECT id INTO viewer_role_id FROM public.roles WHERE name = 'Visualizador' AND is_system = true LIMIT 1;
  IF viewer_role_id IS NULL THEN
    INSERT INTO public.roles (name, description, is_system)
    VALUES ('Visualizador', 'Solo lectura de datos, sin permisos de modificación', true)
    RETURNING id INTO viewer_role_id;
  END IF;

  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT viewer_role_id, id FROM public.permissions 
  WHERE code LIKE '%.view'
  ON CONFLICT DO NOTHING;

END $$;
