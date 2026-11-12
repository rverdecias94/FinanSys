-- Reglas de cierre automático de período (modo manual | monthly + día del mes).
-- Se guarda en business_settings.period (jsonb), sin romper closed_through existente.

ALTER TABLE public.business_settings
  ADD COLUMN IF NOT EXISTS period jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.business_settings.period IS
  'Reglas de cierre: { mode: manual|monthly, day_of_month: 1..28 }. El candado efectivo sigue en period_locks.closed_through.';
