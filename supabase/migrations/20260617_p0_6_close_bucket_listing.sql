-- ============================================================================
-- P0.6 — Cerrar el listado anónimo del bucket `transaction-images`
-- ============================================================================
-- Sesión 3 (2026-06-17). Aplicada en producción vía MCP apply_migration.
-- Versión registrada en el remoto: 20260617231129 (p0_6_close_transaction_images_anon_listing)
--
-- Contexto: el bucket `transaction-images` es público y tenía una política
-- SELECT para el rol `public` ("Permitir lectura pública"), lo que permitía a
-- CUALQUIER cliente anónimo (con la anon key, pública en el bundle) LISTAR
-- todas las carpetas (user_id) y archivos (comprobantes) del bucket
-- (advisor: public_bucket_allows_listing). Con el nombre + carpeta se puede
-- construir la URL pública y descargar comprobantes (PII financiera).
--
-- Clave (doc oficial de Supabase): servir un objeto por URL pública
-- (/object/public/...) NO pasa por RLS; sólo `list` usa la política SELECT.
-- Por eso cerrar el SELECT anónimo NO rompe la visualización de la app
-- (que usa getPublicUrl + <img src>). La app no usa .list() ni .download().
--
-- Fix: reemplazar la política pública por una restringida a usuarios
-- autenticados sobre SU PROPIA carpeta (user_id), mismo patrón que
-- company-logos. INSERT/DELETE (subida/borrado) no se tocan.
--
-- Verificación EN VIVO (Sesión 3):
--   visualización por URL pública: 200 image/png (intacta)
--   listado anónimo (root): antes -> [carpeta+archivo]; después -> 0 (cerrado)
--   owner autenticado lista su carpeta: OK (no rompe operaciones legítimas)
--   get_advisors(security): public_bucket_allows_listing 2 -> 1 (queda company-logos)
--
-- Pendiente menor (ver P2.6): aplicar el mismo cierre a `company-logos`
-- (menos sensible: son logos, no comprobantes). Mejora futura: bucket privado
-- + signed URLs para máxima protección de los comprobantes.
--
-- Rollback: recrear la política pública (no recomendado, reabre el listado):
--   CREATE POLICY "Permitir lectura pública" ON storage.objects
--     FOR SELECT TO public USING (bucket_id = 'transaction-images');
-- ============================================================================

DROP POLICY IF EXISTS "Permitir lectura pública" ON storage.objects;

CREATE POLICY "transaction_images_owner_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'transaction-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
