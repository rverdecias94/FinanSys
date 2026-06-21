-- ============================================================================
-- PAGOS PREMIUM · FASE 7 — Historial de pagos (usuario).
-- (docs/PLAN_PAGOS_PREMIUM.md · Fase 7). Aplicado vía apply_migration.
--
-- get_my_payments(business_id, page, page_size): pagos del negocio del usuario
-- actual, paginado y ordenado por paid_at desc. SECURITY INVOKER: se apoya en la
-- RLS existente de `payments` (payments_read = owner OR miembro activo OR admin),
-- de modo que no re-implementa la autorización y nunca expone pagos de otro
-- negocio. El front pasa el businessId resuelto por BusinessContext; si es NULL,
-- la función lo deriva (owner = uid; si es miembro, el owner de su membresía).
--
-- EXECUTE solo authenticated; REVOKE anon/public. Idempotente.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_my_payments(
  p_business_id uuid DEFAULT NULL,
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 10
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_from integer;
  v_size integer;
  v_biz uuid;
  v_result json;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado' USING ERRCODE = 'P0001';
  END IF;
  v_size := COALESCE(p_page_size, 10);
  v_from := GREATEST(0, (COALESCE(p_page, 1) - 1) * v_size);

  -- Resolver el negocio: si se pasa, se usa (la RLS filtra lo no autorizado);
  -- si no, owner = uid; si es miembro, el owner de su membresía activa.
  v_biz := p_business_id;
  IF v_biz IS NULL THEN
    IF EXISTS (SELECT 1 FROM public.subscriptions s WHERE s.user_id = auth.uid()) THEN
      v_biz := auth.uid();
    ELSE
      SELECT tm.owner_id INTO v_biz FROM public.team_members tm
      WHERE tm.member_id = auth.uid() AND tm.status = 'active' LIMIT 1;
    END IF;
  END IF;

  IF v_biz IS NULL THEN
    RETURN json_build_object('rows', '[]'::json, 'total', 0);
  END IF;

  WITH pay AS (
    SELECT id, amount, currency_code, billing_cycle, period_start, period_end,
           paid_at, method, reference, status, notes
    FROM public.payments
    WHERE business_id = v_biz
    ORDER BY paid_at DESC
  )
  SELECT json_build_object(
    'rows', COALESCE((SELECT json_agg(pg) FROM (SELECT * FROM pay OFFSET v_from LIMIT v_size) pg), '[]'::json),
    'total', (SELECT count(*) FROM pay)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_payments(uuid, integer, integer) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_my_payments(uuid, integer, integer) TO authenticated;

NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- ROLLBACK (manual): DROP FUNCTION IF EXISTS public.get_my_payments(uuid, integer, integer);
-- ============================================================================
