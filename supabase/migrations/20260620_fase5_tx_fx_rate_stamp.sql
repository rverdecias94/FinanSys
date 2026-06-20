-- Nivel 2 (devaluación): sella en cada transacción la tasa vigente el día de la
-- operación: unidades de su moneda por 1 unidad de la moneda base (la principal).
-- NULL = moneda base, o no había tasa registrada ese día. Dato perecedero que se
-- captura ahora para poder analizar pérdidas por devaluación más adelante.
alter table public.transactions
  add column if not exists fx_units_per_base numeric;

comment on column public.transactions.fx_units_per_base is
  'Tasa (unidades de la moneda de la transaccion por 1 de la moneda base) vigente el dia de la operacion. NULL = moneda base o sin tasa registrada. Para analisis de devaluacion (Fase 5, Nivel 2).';
