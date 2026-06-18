-- P2.6 — El bucket público `company-logos` tenía una política SELECT para el rol
-- `public` sobre TODO el bucket → un anónimo podía LISTAR los logos de todos.
-- La app sólo muestra el logo vía getPublicUrl + <img> (businessSettings.js:43-47),
-- y servir por URL pública en un bucket público NO pasa por RLS → cerrar el SELECT
-- anónimo NO rompe la visualización (mismo patrón que P0.6 en transaction-images).
--
-- Rollback:
--   DROP POLICY IF EXISTS company_logos_auth_read ON storage.objects;
--   CREATE POLICY company_logos_public_read ON storage.objects
--     FOR SELECT TO public USING (bucket_id = 'company-logos');

DROP POLICY IF EXISTS company_logos_public_read ON storage.objects;

CREATE POLICY company_logos_auth_read ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'company-logos'
    AND (storage.foldername(name))[1] = (auth.uid())::text
  );
