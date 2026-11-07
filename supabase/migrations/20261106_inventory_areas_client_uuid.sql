-- Create área offline: client_uuid en inventory_areas (idempotencia outbox).

ALTER TABLE public.inventory_areas ADD COLUMN IF NOT EXISTS client_uuid uuid;

CREATE UNIQUE INDEX IF NOT EXISTS inventory_areas_user_client_uuid_uidx
  ON public.inventory_areas (user_id, client_uuid)
  WHERE client_uuid IS NOT NULL;

COMMENT ON COLUMN public.inventory_areas.client_uuid IS
  'Idempotencia outbox offline: mismo (user_id, client_uuid) no duplica el área.';
