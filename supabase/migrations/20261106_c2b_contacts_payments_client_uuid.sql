-- C2b (offline outbox): client_uuid en contacts y account_payments + RPC de abono idempotente.

-- 1) Contactos
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS client_uuid uuid;

CREATE UNIQUE INDEX IF NOT EXISTS contacts_user_client_uuid_uidx
  ON public.contacts (user_id, client_uuid)
  WHERE client_uuid IS NOT NULL;

COMMENT ON COLUMN public.contacts.client_uuid IS
  'Huella de idempotencia del cliente (outbox offline). UNIQUE por negocio cuando no es NULL.';

-- 2) Abonos (ledger)
ALTER TABLE public.account_payments ADD COLUMN IF NOT EXISTS client_uuid uuid;

CREATE UNIQUE INDEX IF NOT EXISTS account_payments_user_client_uuid_uidx
  ON public.account_payments (user_id, client_uuid)
  WHERE client_uuid IS NOT NULL;

COMMENT ON COLUMN public.account_payments.client_uuid IS
  'Huella de idempotencia del abono (outbox offline). UNIQUE por negocio cuando no es NULL.';

-- 3) register_account_payment con p_client_uuid opcional (retrocompatible).
DROP FUNCTION IF EXISTS public.register_account_payment(bigint, numeric, text, text);

CREATE OR REPLACE FUNCTION public.register_account_payment(
  p_transaction_id bigint,
  p_amount numeric,
  p_method text DEFAULT NULL,
  p_note text DEFAULT NULL,
  p_client_uuid uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_business uuid := public.get_current_business_id();
  v_tx public.transactions;
  v_total numeric;
  v_paid numeric;
  v_status text;
  v_existing_id bigint;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'El monto del pago debe ser mayor que cero' USING ERRCODE = '22023';
  END IF;
  IF NOT public.has_permission_secure(v_business, 'finanzas.edit') THEN
    RAISE EXCEPTION 'No autorizado: requiere permiso finanzas.edit' USING ERRCODE = '42501';
  END IF;

  -- Idempotencia: mismo client_uuid → devolver estado actual sin duplicar abono.
  IF p_client_uuid IS NOT NULL THEN
    SELECT id INTO v_existing_id
    FROM public.account_payments
    WHERE user_id = v_business AND client_uuid = p_client_uuid;
    IF FOUND THEN
      SELECT * INTO v_tx FROM public.transactions
      WHERE id = p_transaction_id AND user_id = v_business;
      RETURN jsonb_build_object(
        'id', v_tx.id,
        'type', v_tx.type,
        'description', v_tx.description,
        'amount', v_tx.amount,
        'paid_amount', v_tx.paid_amount,
        'status', v_tx.status,
        'idempotent', true
      );
    END IF;
  END IF;

  SELECT * INTO v_tx FROM public.transactions
  WHERE id = p_transaction_id AND user_id = v_business
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cuenta no encontrada en el negocio' USING ERRCODE = 'P0002';
  END IF;

  v_total := v_tx.amount;
  SELECT coalesce(sum(amount), 0) INTO v_paid
  FROM public.account_payments WHERE transaction_id = p_transaction_id;

  IF v_paid + p_amount > v_total + 0.005 THEN
    RAISE EXCEPTION 'El abono excede el saldo pendiente' USING ERRCODE = '23514';
  END IF;

  INSERT INTO public.account_payments (user_id, transaction_id, amount, paid_at, method, note, client_uuid)
  VALUES (v_business, p_transaction_id, p_amount, now(), p_method, p_note, p_client_uuid);

  v_paid := v_paid + p_amount;
  v_status := CASE WHEN v_paid >= v_total THEN 'paid' ELSE 'partial' END;

  UPDATE public.transactions
  SET paid_amount = v_paid, status = v_status
  WHERE id = p_transaction_id AND user_id = v_business
  RETURNING * INTO v_tx;

  RETURN jsonb_build_object(
    'id', v_tx.id,
    'type', v_tx.type,
    'description', v_tx.description,
    'amount', v_tx.amount,
    'paid_amount', v_tx.paid_amount,
    'status', v_tx.status
  );
END;
$$;

REVOKE ALL ON FUNCTION public.register_account_payment(bigint, numeric, text, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_account_payment(bigint, numeric, text, text, uuid) TO authenticated;
