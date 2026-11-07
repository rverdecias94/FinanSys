-- C5b (offline outbox): client_uuid en products para crear producto offline.

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS client_uuid uuid;

CREATE UNIQUE INDEX IF NOT EXISTS products_user_client_uuid_uidx
  ON public.products (user_id, client_uuid)
  WHERE client_uuid IS NOT NULL;

COMMENT ON COLUMN public.products.client_uuid IS
  'Huella de idempotencia del cliente (outbox offline). UNIQUE por negocio cuando no es NULL.';
