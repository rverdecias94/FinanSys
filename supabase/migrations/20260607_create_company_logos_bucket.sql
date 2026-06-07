-- Bucket para logos de empresas (solo URL en business_settings.company.logoUrl)

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'company-logos',
  'company-logos',
  true,
  2097152, -- 2MB
  ARRAY['image/png', 'image/svg+xml']
)
ON CONFLICT (id) DO NOTHING;

-- Lectura pública (facturas, reportes, vista previa)
DROP POLICY IF EXISTS "company_logos_public_read" ON storage.objects;
CREATE POLICY "company_logos_public_read" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'company-logos');

-- Solo el propietario puede subir/actualizar/eliminar en su carpeta {user_id}/
DROP POLICY IF EXISTS "company_logos_owner_insert" ON storage.objects;
CREATE POLICY "company_logos_owner_insert" ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'company-logos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "company_logos_owner_update" ON storage.objects;
CREATE POLICY "company_logos_owner_update" ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'company-logos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'company-logos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "company_logos_owner_delete" ON storage.objects;
CREATE POLICY "company_logos_owner_delete" ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'company-logos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Eliminar logos base64 legacy del JSON (solo debe quedar logoUrl)
UPDATE public.business_settings
SET company = company - 'logoDataUrl'
WHERE company ? 'logoDataUrl';
