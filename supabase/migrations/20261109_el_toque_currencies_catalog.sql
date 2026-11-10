-- Ampliar catálogo global con monedas cotizadas en el mercado informal cubano
-- (El Toque): MLC, CAD, ZELLE, CLA. No borra ni altera CUP/USD/EUR/MXN.

insert into public.currencies (code, name, symbol, flag_url) values
  ('MLC', 'Moneda Libremente Convertible', 'MLC', '🇨🇺'),
  ('CAD', 'Dólar Canadiense', 'C$', '🇨🇦'),
  ('ZELLE', 'Zelle', 'Zelle', '💜'),
  ('CLA', 'Tarjeta Clásica', 'CLA', '💳')
on conflict (code) do nothing;
