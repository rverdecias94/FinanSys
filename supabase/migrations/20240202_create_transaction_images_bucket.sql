-- Crear bucket para imágenes de transacciones
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'transaction-images',
  'transaction-images',
  true,
  5242880, -- 5MB en bytes
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
);

-- Crear políticas de seguridad para el bucket
-- Permitir lectura pública
CREATE POLICY "Permitir lectura pública" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'transaction-images');

-- Permitir inserción a usuarios autenticados
CREATE POLICY "Permitir inserción a usuarios autenticados" ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'transaction-images');

-- Permitir actualización a usuarios autenticados
CREATE POLICY "Permitir actualización a usuarios autenticados" ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'transaction-images')
  WITH CHECK (bucket_id = 'transaction-images');

-- Permitir eliminación a usuarios autenticados
CREATE POLICY "Permitir eliminación a usuarios autenticados" ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'transaction-images');