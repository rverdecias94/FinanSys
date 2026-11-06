-- C1 (offline outbox): garantiza client_uuid + UNIQUE parcial en transactions.
-- Ya aplicada de forma equivalente en 20260704_register_sale_idempotent.sql;
-- este archivo es idempotente (IF NOT EXISTS) para entornos que no tengan esa migración.

ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS client_uuid uuid;

CREATE UNIQUE INDEX IF NOT EXISTS transactions_user_client_uuid_uidx
  ON public.transactions (user_id, client_uuid)
  WHERE client_uuid IS NOT NULL;

COMMENT ON COLUMN public.transactions.client_uuid IS
  'Huella de idempotencia generada en el cliente (outbox offline / reintentos). UNIQUE por negocio cuando no es NULL.';
