-- ============================================================================
-- Rebalanceo planes Inicial / Negocio (Élite sin cambios económicos/funcionales).
-- Precios: $0 / $10 / $20. Anual −20% se conserva.
-- Idempotente.
-- ============================================================================

UPDATE public.plans
SET
  name = 'Plan Inicial',
  price_monthly = 0,
  features = jsonb_build_object(
    'reports_export', false,
    'audit_logs', false,
    'custom_branding', false,
    'watermark', true,
    'ai_tools', false
  ),
  limits = jsonb_build_object(
    'monthly_transactions', 150,
    'products', 50,
    'areas', 1,
    'partners', 0,
    'currencies', 1,
    'ai_doc_pages', 0,
    'ai_calc_queries', 0
  ),
  pricing = COALESCE(pricing, '{}'::jsonb) || jsonb_build_object(
    'monthly', 0,
    'annual', 0,
    'annual_discount_pct', 20,
    'currency', 'USD'
  )
WHERE id = 'free';

UPDATE public.plans
SET
  name = 'Plan Negocio',
  price_monthly = 10,
  features = jsonb_build_object(
    'reports_export', true,
    'audit_logs', true,
    'custom_branding', true,
    'watermark', false,
    'ai_tools', true
  ),
  limits = jsonb_build_object(
    'monthly_transactions', 1500,
    'products', 200,
    'areas', 3,
    'partners', 3,
    'currencies', 2,
    'ai_doc_pages', 20,
    'ai_calc_queries', 15
  ),
  pricing = COALESCE(pricing, '{}'::jsonb) || jsonb_build_object(
    'monthly', 10,
    'annual', 96,
    'annual_discount_pct', 20,
    'currency', 'USD'
  )
WHERE id = 'premium';

-- Élite: confirmar topes (sin tocar precio)
UPDATE public.plans
SET
  name = 'Plan Élite',
  price_monthly = 20,
  features = jsonb_build_object(
    'reports_export', true,
    'audit_logs', true,
    'custom_branding', true,
    'watermark', false,
    'ai_tools', true
  ),
  limits = jsonb_build_object(
    'monthly_transactions', -1,
    'products', -1,
    'areas', -1,
    'partners', 10,
    'currencies', -1,
    'ai_doc_pages', 100,
    'ai_calc_queries', 50
  ),
  pricing = COALESCE(pricing, '{}'::jsonb) || jsonb_build_object(
    'monthly', 20,
    'annual', 192,
    'annual_discount_pct', 20,
    'currency', 'USD'
  )
WHERE id = 'ultra';
