-- Harness de verificación P0-001 (ejecutar en rama/preview, NO en prod a ciegas).
-- Tras aplicar 20261109_p0_001_transaction_images_tenant_isolation.sql:

-- 1) Políticas esperadas presentes
select policyname, cmd
from pg_policies
where schemaname = 'storage'
  and tablename = 'objects'
  and (
    policyname like 'transaction_images_business_%'
    or coalesce(qual, '') ilike '%transaction-images%'
    or coalesce(with_check, '') ilike '%transaction-images%'
  )
order by cmd, policyname;

-- Esperado:
--   transaction_images_business_delete  | DELETE
--   transaction_images_business_insert  | INSERT
--   transaction_images_business_select  | SELECT
--   transaction_images_business_update  | UPDATE
-- Y AUSENCIA de:
--   "Permitir inserción/actualización/eliminación a usuarios autenticados"

-- 2) Las nuevas policies deben mencionar get_current_business_id
select policyname,
  (coalesce(qual, '') || coalesce(with_check, '')) ilike '%get_current_business_id%' as uses_business_id
from pg_policies
where schemaname = 'storage'
  and policyname like 'transaction_images_business_%';

-- Esperado: uses_business_id = true en las 4.
