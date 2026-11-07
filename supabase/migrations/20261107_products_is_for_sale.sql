-- Distingue mercancía para venta vs consumo interno (cocina, buffet, insumos).
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS is_for_sale boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.products.is_for_sale IS
  'true = se vende (precio/margen FX aplica); false = solo consumo interno sin sugerir precio de venta.';
