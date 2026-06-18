-- P1.4 (Sesión 4, 2026-06-18) — APLICADO Y VERIFICADO en producción (remoto: p1_4_inventory_items_align_rbac_crud).
-- Divergencia RBAC: la UI (FormRunner.jsx:128,314,319) gatea con inventory.create/edit/delete, pero la
-- RLS de inventory_items exigía inventory.move (FOR ALL). Un rol personalizado sin "move" quedaba roto
-- (la UI mostraba el formulario y botones, pero la RLS rechazaba INSERT/UPDATE/DELETE con 403).
-- inventory.move NO se usa en ningún archivo cliente; las tablas hermanas (inventory_areas, _fields,
-- _prefixes) ya usaban create/edit/delete. Fuente de verdad = UI + catálogo. Se alinea la RLS.
-- Verificado: miembro real con rol custom (create/edit/delete/view, sin move) -> antes 403, después
-- INSERT 201 / UPDATE 200 / DELETE 204. Ningún rol pierde acceso (Administrador/Editor tienen create/edit/delete).
-- Rollback: DROP de las 3 políticas nuevas y recrear inventory_items_write FOR ALL con inventory.move.

DROP POLICY IF EXISTS inventory_items_write ON public.inventory_items;

CREATE POLICY inventory_items_insert ON public.inventory_items
FOR INSERT
WITH CHECK (
  user_id = public.get_current_business_id()
  AND public.has_permission_secure(user_id, 'inventory.create')
);

CREATE POLICY inventory_items_update ON public.inventory_items
FOR UPDATE
USING (public.has_permission_secure(user_id, 'inventory.edit'))
WITH CHECK (
  user_id = public.get_current_business_id()
  AND public.has_permission_secure(user_id, 'inventory.edit')
);

CREATE POLICY inventory_items_delete ON public.inventory_items
FOR DELETE
USING (public.has_permission_secure(user_id, 'inventory.delete'));
