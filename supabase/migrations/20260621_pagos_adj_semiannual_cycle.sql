-- ============================================================================
-- AJUSTE PAGOS (2026-06-21) — Ciclo SEMESTRAL (6 meses, -5%) y ANUAL (-15%).
-- Reemplaza la oferta "trimestral" por "semestral". Mantiene 'quarterly'
-- permitido en los CHECK por compatibilidad de datos históricos.
-- Aplicado vía apply_migration (pagos_adj_semiannual_cycle).
-- ============================================================================

-- 1) Precios (fuente única en plans.pricing).
UPDATE public.plans
SET pricing = jsonb_build_object(
  'monthly', 10,
  'semiannual', 57,
  'annual', 102,
  'semiannual_discount_pct', 5,
  'annual_discount_pct', 15,
  'currency', 'USD'
)
WHERE id = 'premium';

-- 2) CHECK constraints: permitir 'semiannual'.
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conrelid::regclass::text AS tbl, conname
    FROM pg_constraint
    WHERE contype = 'c' AND conname ILIKE '%billing_cycle%'
      AND conrelid IN ('public.subscriptions'::regclass, 'public.payments'::regclass, 'public.plan_change_requests'::regclass)
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', c.tbl, c.conname);
  END LOOP;
END $$;

ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_billing_cycle_check
  CHECK (billing_cycle = ANY (ARRAY['monthly','quarterly','semiannual','annual']));
ALTER TABLE public.payments ADD CONSTRAINT payments_billing_cycle_check
  CHECK (billing_cycle = ANY (ARRAY['monthly','quarterly','semiannual','annual']));
ALTER TABLE public.plan_change_requests ADD CONSTRAINT plan_change_requests_billing_cycle_check
  CHECK (billing_cycle = ANY (ARRAY['monthly','quarterly','semiannual','annual']));

-- 3) Meses por ciclo: + semestral = 6. premium_price_for_cycle no cambia
--    (lee plans.pricing ->> cycle; ya incluye 'semiannual').
CREATE OR REPLACE FUNCTION public.billing_cycle_months(p_cycle text)
RETURNS integer LANGUAGE sql IMMUTABLE SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT CASE p_cycle WHEN 'monthly' THEN 1 WHEN 'quarterly' THEN 3 WHEN 'semiannual' THEN 6 WHEN 'annual' THEN 12 ELSE 1 END;
$function$;

-- 4) RPCs (request_plan_change, approve_plan_change_request, admin_set_business_plan,
--    admin_record_payment): aceptar 'semiannual' en las validaciones y derivar el
--    ciclo desde meses (6 -> semestral). Ver definición aplicada en la BD; el único
--    cambio respecto a la versión previa es añadir 'semiannual'/WHEN 6 en cada una.
-- (cuerpos completos aplicados vía apply_migration; idempotentes con CREATE OR REPLACE)

NOTIFY pgrst, 'reload schema';
