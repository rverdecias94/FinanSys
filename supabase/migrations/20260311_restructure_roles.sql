-- Migration to restructure roles and permissions according to user requirements

-- 1. Remove "Administrador Limitado" role
DELETE FROM public.role_permissions 
WHERE role_id IN (SELECT id FROM public.roles WHERE name = 'Administrador Limitado');

DELETE FROM public.roles 
WHERE name = 'Administrador Limitado';

-- 2. Insert missing permissions and update descriptions
-- Warehouse (Almacen)
INSERT INTO public.permissions (code, module, description) VALUES
  ('warehouse.view', 'Almacén', 'Ver lista de productos y movimientos'),
  ('warehouse.create', 'Almacén', 'Crear nuevos productos'),
  ('warehouse.edit', 'Almacén', 'Editar información de productos'),
  ('warehouse.delete', 'Almacén', 'Eliminar productos'),
  ('warehouse.move', 'Almacén', 'Registrar entradas y salidas de stock')
ON CONFLICT (code) DO UPDATE SET 
  module = EXCLUDED.module,
  description = EXCLUDED.description;

-- Reports (Reportes)
INSERT INTO public.permissions (code, module, description) VALUES
  ('reports.view', 'Reportes', 'Acceder al módulo de reportes'),
  ('reports.export', 'Reportes', 'Exportar reportes a PDF/Excel')
ON CONFLICT (code) DO UPDATE SET 
  module = EXCLUDED.module,
  description = EXCLUDED.description;

-- Update existing descriptions to be more user-friendly
UPDATE public.permissions SET description = 'Ver panel principal y estadísticas clave' WHERE code = 'dashboard.view';
UPDATE public.permissions SET description = 'Ver listados de ingresos y gastos' WHERE code = 'finanzas.view';
UPDATE public.permissions SET description = 'Registrar nuevas transacciones financieras' WHERE code = 'finanzas.create';
UPDATE public.permissions SET description = 'Modificar transacciones existentes' WHERE code = 'finanzas.edit';
UPDATE public.permissions SET description = 'Eliminar registros financieros' WHERE code = 'finanzas.delete';
UPDATE public.permissions SET description = 'Descargar datos financieros' WHERE code = 'finanzas.export';
UPDATE public.permissions SET description = 'Ver inventario actual' WHERE code = 'inventory.view';
UPDATE public.permissions SET description = 'Agregar nuevos ítems al inventario' WHERE code = 'inventory.create';
UPDATE public.permissions SET description = 'Modificar datos de ítems de inventario' WHERE code = 'inventory.edit';
UPDATE public.permissions SET description = 'Eliminar ítems del inventario' WHERE code = 'inventory.delete';
UPDATE public.permissions SET description = 'Ajustar niveles de stock manualmente' WHERE code = 'inventory.move';
UPDATE public.permissions SET description = 'Ver configuración general del sistema' WHERE code = 'config.view';
UPDATE public.permissions SET description = 'Editar configuración (monedas, balances, categorías)' WHERE code = 'config.edit';
UPDATE public.permissions SET description = 'Gestionar equipo y roles de usuario' WHERE code = 'team.manage';
UPDATE public.permissions SET description = 'Ver historial de actividades del sistema' WHERE code = 'logs.view';

-- 3. Configure "Editor" Role
DO $$
DECLARE
  editor_role_id uuid;
  viewer_role_id uuid;
BEGIN
  -- Get or Create Editor Role
  SELECT id INTO editor_role_id FROM public.roles WHERE name = 'Editor' AND is_system = true LIMIT 1;
  IF editor_role_id IS NULL THEN
    INSERT INTO public.roles (name, description, is_system)
    VALUES ('Editor', 'Acceso completo a operativa (Finanzas, Almacén, Inventario, Reportes). Sin acceso a configuración.', true)
    RETURNING id INTO editor_role_id;
  ELSE
    UPDATE public.roles SET description = 'Acceso completo a operativa (Finanzas, Almacén, Inventario, Reportes). Sin acceso a configuración.' WHERE id = editor_role_id;
  END IF;

  -- Clear existing permissions for Editor to start fresh
  DELETE FROM public.role_permissions WHERE role_id = editor_role_id;

  -- Assign permissions to Editor
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT editor_role_id, id FROM public.permissions 
  WHERE code IN (
    'dashboard.view',
    'finanzas.view', 'finanzas.create', 'finanzas.edit', 'finanzas.delete', 'finanzas.export',
    'warehouse.view', 'warehouse.create', 'warehouse.edit', 'warehouse.delete', 'warehouse.move',
    'inventory.view', 'inventory.create', 'inventory.edit', 'inventory.delete', 'inventory.move',
    'reports.view', 'reports.export'
  );

  -- 4. Configure "Visualizador" Role
  -- Get or Create Visualizador Role
  SELECT id INTO viewer_role_id FROM public.roles WHERE name = 'Visualizador' AND is_system = true LIMIT 1;
  IF viewer_role_id IS NULL THEN
    INSERT INTO public.roles (name, description, is_system)
    VALUES ('Visualizador', 'Solo lectura. Puede ver datos y reportes pero no realizar cambios.', true)
    RETURNING id INTO viewer_role_id;
  ELSE
    UPDATE public.roles SET description = 'Solo lectura. Puede ver datos y reportes pero no realizar cambios.' WHERE id = viewer_role_id;
  END IF;

  -- Clear existing permissions for Viewer
  DELETE FROM public.role_permissions WHERE role_id = viewer_role_id;

  -- Assign permissions to Viewer (Only *.view and export)
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT viewer_role_id, id FROM public.permissions 
  WHERE code IN (
    'dashboard.view',
    'finanzas.view', 'finanzas.export',
    'warehouse.view',
    'inventory.view',
    'reports.view', 'reports.export'
  );

END $$;
