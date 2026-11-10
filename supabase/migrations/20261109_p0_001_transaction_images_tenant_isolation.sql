-- ============================================================================
-- P0-001 — Aislamiento multi-tenant en Storage `transaction-images`
-- ============================================================================
-- Causa raíz (confirmada en prod, pg_policies):
--   INSERT/UPDATE/DELETE solo comprobaban bucket_id = 'transaction-images'.
--   Cualquier authenticated podía sobrescribir o borrar comprobantes de otro negocio.
--
-- Modelo de rutas (frontend, src/services/finanzas.js):
--   `{businessId}/{timestamp}-{rand}.ext`
--   businessId = getEffectiveUserId = owner_id del negocio (no el auth.uid() del miembro).
--
-- Corrección:
--   USING / WITH CHECK: carpeta[1] = public.get_current_business_id()::text
--   Así el titular Y los miembros activos del mismo negocio operan en su carpeta;
--   otros negocios quedan denegados. La pertenencia se resuelve en servidor
--   (team_members / auth.uid), no solo con la ruta que manda el cliente.
--
-- SELECT: se alinea al mismo criterio (antes usaba auth.uid(), incompatible con
--   la carpeta businessId → los miembros no podían listar). getPublicUrl en bucket
--   público sigue sirviendo sin pasar por RLS (comportamiento ya documentado en P0.6).
--
-- NO toca: company-logos, otros buckets, tablas de negocio, RLS de transactions.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- POLÍTICAS ANTERIORES (snapshot para recuperación)
-- ---------------------------------------------------------------------------
-- SELECT (prod actual):
--   CREATE POLICY "transaction_images_owner_read" ON storage.objects
--     FOR SELECT TO authenticated
--     USING (
--       bucket_id = 'transaction-images'
--       AND (storage.foldername(name))[1] = (auth.uid())::text
--     );
--
-- INSERT (prod actual):
--   CREATE POLICY "Permitir inserción a usuarios autenticados" ON storage.objects
--     FOR INSERT TO authenticated
--     WITH CHECK (bucket_id = 'transaction-images');
--
-- UPDATE (prod actual):
--   CREATE POLICY "Permitir actualización a usuarios autenticados" ON storage.objects
--     FOR UPDATE TO authenticated
--     USING (bucket_id = 'transaction-images')
--     WITH CHECK (bucket_id = 'transaction-images');
--
-- DELETE (prod actual):
--   CREATE POLICY "Permitir eliminación a usuarios autenticados" ON storage.objects
--     FOR DELETE TO authenticated
--     USING (bucket_id = 'transaction-images');
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Permitir inserción a usuarios autenticados" ON storage.objects;
DROP POLICY IF EXISTS "Permitir actualización a usuarios autenticados" ON storage.objects;
DROP POLICY IF EXISTS "Permitir eliminación a usuarios autenticados" ON storage.objects;
DROP POLICY IF EXISTS "transaction_images_owner_read" ON storage.objects;

-- Lectura/listado: solo objetos bajo la carpeta del negocio actual.
CREATE POLICY "transaction_images_business_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'transaction-images'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = public.get_current_business_id()::text
  );

-- Alta: la ruta DEBE vivir bajo la carpeta del negocio resuelto en servidor.
CREATE POLICY "transaction_images_business_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'transaction-images'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = public.get_current_business_id()::text
  );

-- Upsert/reemplazo: objeto existente y nueva ruta en la misma carpeta de negocio.
CREATE POLICY "transaction_images_business_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'transaction-images'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = public.get_current_business_id()::text
  )
  WITH CHECK (
    bucket_id = 'transaction-images'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = public.get_current_business_id()::text
  );

-- Borrado: solo dentro de la carpeta del negocio actual.
CREATE POLICY "transaction_images_business_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'transaction-images'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = public.get_current_business_id()::text
  );

-- ---------------------------------------------------------------------------
-- ROLLBACK (recreación de políticas previas — NO recomendado en prod):
-- ---------------------------------------------------------------------------
-- DROP POLICY IF EXISTS "transaction_images_business_select" ON storage.objects;
-- DROP POLICY IF EXISTS "transaction_images_business_insert" ON storage.objects;
-- DROP POLICY IF EXISTS "transaction_images_business_update" ON storage.objects;
-- DROP POLICY IF EXISTS "transaction_images_business_delete" ON storage.objects;
--
-- CREATE POLICY "transaction_images_owner_read" ON storage.objects
--   FOR SELECT TO authenticated
--   USING (
--     bucket_id = 'transaction-images'
--     AND (storage.foldername(name))[1] = (auth.uid())::text
--   );
-- CREATE POLICY "Permitir inserción a usuarios autenticados" ON storage.objects
--   FOR INSERT TO authenticated
--   WITH CHECK (bucket_id = 'transaction-images');
-- CREATE POLICY "Permitir actualización a usuarios autenticados" ON storage.objects
--   FOR UPDATE TO authenticated
--   USING (bucket_id = 'transaction-images')
--   WITH CHECK (bucket_id = 'transaction-images');
-- CREATE POLICY "Permitir eliminación a usuarios autenticados" ON storage.objects
--   FOR DELETE TO authenticated
--   USING (bucket_id = 'transaction-images');
-- ============================================================================
