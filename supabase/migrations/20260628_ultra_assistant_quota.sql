-- ============================================================================
-- Ultra: cupo de consultas del asistente (antes "calc") sube a 120/mes.
-- Idempotente.
-- ============================================================================

UPDATE public.plans
SET limits = COALESCE(limits, '{}'::jsonb) || jsonb_build_object(
  'ai_doc_pages', COALESCE((limits ->> 'ai_doc_pages')::integer, 100),
  'ai_calc_queries', 120
)
WHERE id = 'ultra';
