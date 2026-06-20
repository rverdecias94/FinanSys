-- ============================================================================
-- PAGOS PREMIUM · FASE 1 — Hardening de grants/índices (resuelve advisors)
-- La RLS ya protege filas; esto además: cierra el acceso de `anon` a datos
-- financieros, indexa las FK de payments y optimiza la policy payments_read
-- (auth.* dentro de subselect → se evalúa una sola vez a escala). Idempotente.
-- ============================================================================

-- 1) Quitar acceso anon a datos financieros (authenticated sigue, gateado por RLS)
REVOKE ALL ON public.payments FROM anon;
REVOKE ALL ON public.billing_config FROM anon;
GRANT SELECT ON public.payments TO authenticated;
GRANT SELECT ON public.billing_config TO authenticated;

-- 2) Funciones SECURITY DEFINER: ejecutables solo por authenticated (no anon/public)
REVOKE EXECUTE ON FUNCTION public.get_effective_plan_state(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_record_payment(uuid,numeric,text,text,timestamptz,timestamptz,text,text,text,uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.premium_price_for_cycle(text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.billing_cycle_months(text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.approve_plan_change_request(uuid,integer,text,text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_set_business_plan(uuid,text,integer,text,text) FROM anon, public;

GRANT EXECUTE ON FUNCTION public.get_effective_plan_state(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_record_payment(uuid,numeric,text,text,timestamptz,timestamptz,text,text,text,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.premium_price_for_cycle(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.billing_cycle_months(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_plan_change_request(uuid,integer,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_business_plan(uuid,text,integer,text,text) TO authenticated;

-- 3) Índices para las FK de payments (advisor: unindexed_foreign_keys)
CREATE INDEX IF NOT EXISTS idx_payments_request_id ON public.payments (request_id);
CREATE INDEX IF NOT EXISTS idx_payments_recorded_by ON public.payments (recorded_by);

-- 4) Optimizar payments_read (advisor: auth_rls_init_plan)
DROP POLICY IF EXISTS payments_read ON public.payments;
CREATE POLICY payments_read ON public.payments FOR SELECT TO authenticated
USING (
  business_id = (select auth.uid())
  OR business_id IN (
    select tm.owner_id from public.team_members tm
    where tm.member_id = (select auth.uid()) and tm.status = 'active'
  )
  OR (select public.is_system_admin())
);

NOTIFY pgrst, 'reload schema';
