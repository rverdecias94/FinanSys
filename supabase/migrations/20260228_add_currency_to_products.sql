-- Add currency column to products table
alter table public.products 
add column if not exists currency text default 'USD';

-- Add foreign key constraint
alter table public.products
add constraint products_currency_fkey
foreign key (currency) references public.currencies(code);
