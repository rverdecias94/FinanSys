-- Permitir lectura pública de categorías y métodos de pago
drop policy if exists finance_categories_read_all on public.finance_categories;
create policy finance_categories_read_all on public.finance_categories
for select
to public
using (is_active = true);

drop policy if exists payment_methods_read_all on public.payment_methods;
create policy payment_methods_read_all on public.payment_methods
for select
to public
using (is_active = true);
