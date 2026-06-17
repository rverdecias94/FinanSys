-- ============================================================================
-- P1.3 — Exigir config.view para LEER business_settings (cierra fuga RBAC)
-- ============================================================================
-- Sesión 3 (2026-06-17). Aplicada en producción vía MCP apply_migration.
-- Versión registrada en el remoto: 20260617230847 (p1_3_business_settings_require_config_view)
--
-- Contexto: la política previa ("Owner and Team can view business_settings",
-- creada por la migración `team_member_read_config_data`) permitía a CUALQUIER
-- miembro de equipo (status active/accepted) leer business_settings, sin exigir
-- el permiso `config.view`. El cliente bloqueaba el panel, pero la RLS no
-- bloqueaba la lectura directa por API REST → fuga de datos del negocio.
--
-- Fix: usar el patrón canónico has_permission_secure (igual que transactions).
-- El dueño conserva acceso total porque has_permission_secure(uid, code)
-- devuelve TRUE cuando auth.uid() = target_owner_id. Sólo se lee en el panel
-- /configuracion (que ya exige config.view), por lo que no rompe la app.
--
-- Verificación EN VIVO (Sesión 3) con cuenta de miembro (Editor, sin config.view):
--   ANTES: GET /rest/v1/business_settings?user_id=eq.<owner> -> 200, 1 fila (fuga)
--   DESPUÉS: mismo GET -> 200, 0 filas (cerrado). Dueño: 1 fila (intacto).
--
-- Rollback: recrear la política anterior (no recomendado, reabre la fuga).
-- ============================================================================

DROP POLICY IF EXISTS "Owner and Team can view business_settings" ON public.business_settings;

CREATE POLICY "business_settings_read" ON public.business_settings
  FOR SELECT
  USING (has_permission_secure(user_id, 'config.view'));
