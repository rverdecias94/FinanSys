-- CLA = Tarjeta Clásica (tarjeta en USD de uso local en Cuba; cotiza aparte del efectivo).
update public.currencies
set name = 'Tarjeta Clásica',
    symbol = 'CLA',
    flag_url = '💳'
where code = 'CLA';
