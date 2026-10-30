-- Negocio: 10 áreas, monedas ilimitadas, 5 miembros. Resto igual.
UPDATE public.plans
SET limits = COALESCE(limits, '{}'::jsonb) || jsonb_build_object(
  'areas', 10,
  'currencies', -1,
  'partners', 5
)
WHERE id = 'premium';
