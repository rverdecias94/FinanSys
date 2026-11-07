-- C2d (offline outbox): client_uuid en recurring_transactions.

ALTER TABLE public.recurring_transactions ADD COLUMN IF NOT EXISTS client_uuid uuid;

CREATE UNIQUE INDEX IF NOT EXISTS recurring_transactions_user_client_uuid_uidx
  ON public.recurring_transactions (user_id, client_uuid)
  WHERE client_uuid IS NOT NULL;

COMMENT ON COLUMN public.recurring_transactions.client_uuid IS
  'Huella de idempotencia del cliente (outbox offline). UNIQUE por negocio cuando no es NULL.';
