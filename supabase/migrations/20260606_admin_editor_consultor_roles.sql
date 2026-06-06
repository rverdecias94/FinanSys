DO $$
DECLARE
  admin_role_id uuid;
  editor_role_id uuid;
  consultor_role_id uuid;
BEGIN
  SELECT id INTO admin_role_id FROM public.roles WHERE name = 'Admin' AND is_system = true LIMIT 1;
  IF admin_role_id IS NULL THEN
    INSERT INTO public.roles (name, description, is_system)
    VALUES ('Admin', 'Acceso completo (operativa + configuración + equipo + auditoría).', true)
    RETURNING id INTO admin_role_id;
  END IF;
  DELETE FROM public.role_permissions WHERE role_id = admin_role_id;
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT admin_role_id, id FROM public.permissions
  WHERE code IN (
    'dashboard.view',
    'finanzas.view', 'finanzas.create', 'finanzas.edit', 'finanzas.delete', 'finanzas.export',
    'warehouse.view', 'warehouse.create', 'warehouse.edit', 'warehouse.delete', 'warehouse.move',
    'inventory.view', 'inventory.create', 'inventory.edit', 'inventory.delete', 'inventory.move',
    'reports.view', 'reports.export',
    'config.view', 'config.edit',
    'team.manage',
    'logs.view'
  );

  SELECT id INTO editor_role_id FROM public.roles WHERE name = 'Editor' AND is_system = true LIMIT 1;
  IF editor_role_id IS NULL THEN
    INSERT INTO public.roles (name, description, is_system)
    VALUES ('Editor', 'Acceso a operativa (Finanzas, Almacén, Inventario, Reportes). Sin configuración.', true)
    RETURNING id INTO editor_role_id;
  END IF;
  DELETE FROM public.role_permissions WHERE role_id = editor_role_id;
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT editor_role_id, id FROM public.permissions
  WHERE code IN (
    'dashboard.view',
    'finanzas.view', 'finanzas.create', 'finanzas.edit', 'finanzas.delete', 'finanzas.export',
    'warehouse.view', 'warehouse.create', 'warehouse.edit', 'warehouse.delete', 'warehouse.move',
    'inventory.view', 'inventory.create', 'inventory.edit', 'inventory.delete', 'inventory.move',
    'reports.view', 'reports.export'
  );

  SELECT id INTO consultor_role_id FROM public.roles WHERE name = 'Consultor' AND is_system = true LIMIT 1;
  IF consultor_role_id IS NULL THEN
    INSERT INTO public.roles (name, description, is_system)
    VALUES ('Consultor', 'Solo lectura con exportación de reportes.', true)
    RETURNING id INTO consultor_role_id;
  END IF;
  DELETE FROM public.role_permissions WHERE role_id = consultor_role_id;
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT consultor_role_id, id FROM public.permissions
  WHERE code IN (
    'dashboard.view',
    'finanzas.view', 'finanzas.export',
    'warehouse.view',
    'inventory.view',
    'reports.view', 'reports.export'
  );
END $$;

