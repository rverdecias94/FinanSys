-- Unidad de trabajo del producto: stock, costo y precio hablan de la misma cosa.
-- 'unit' = unidad/pieza; 'box' = caja (opcionalmente con units_per_box para equivalencia).

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS stock_unit text NOT NULL DEFAULT 'unit'
    CHECK (stock_unit IN ('unit', 'box'));

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS units_per_box numeric
    CHECK (units_per_box IS NULL OR units_per_box > 0);

COMMENT ON COLUMN public.products.stock_unit IS
  'Cómo se cuenta en almacén: unit (pieza) o box (caja). Precio, costo y stock usan esta unidad.';

COMMENT ON COLUMN public.products.units_per_box IS
  'Si stock_unit=box, cuántas unidades trae cada caja (solo equivalencia informativa).';
