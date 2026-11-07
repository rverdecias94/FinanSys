-- C5 (offline outbox): idempotencia de movimiento rápido de almacén.
-- client_uuid en warehouse_documents (raíz del quick movement) + RPC con p_client_uuid.

ALTER TABLE public.warehouse_documents ADD COLUMN IF NOT EXISTS client_uuid uuid;

CREATE UNIQUE INDEX IF NOT EXISTS warehouse_documents_user_client_uuid_uidx
  ON public.warehouse_documents (user_id, client_uuid)
  WHERE client_uuid IS NOT NULL;

COMMENT ON COLUMN public.warehouse_documents.client_uuid IS
  'Huella de idempotencia del movimiento rápido offline (outbox). UNIQUE por negocio cuando no es NULL.';

-- También en movements (trazabilidad / futuros flujos).
ALTER TABLE public.movements ADD COLUMN IF NOT EXISTS client_uuid uuid;

CREATE UNIQUE INDEX IF NOT EXISTS movements_user_client_uuid_uidx
  ON public.movements (user_id, client_uuid)
  WHERE client_uuid IS NOT NULL;

COMMENT ON COLUMN public.movements.client_uuid IS
  'Huella de idempotencia del movimiento (outbox). UNIQUE por negocio cuando no es NULL.';

-- Firma anterior (5 args) → nueva con p_client_uuid opcional.
DROP FUNCTION IF EXISTS public.create_and_post_quick_movement(bigint, numeric, text, numeric, text);

CREATE OR REPLACE FUNCTION public.create_and_post_quick_movement(
  p_product_id bigint,
  p_qty numeric,
  p_type text,
  p_unit_cost numeric DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_client_uuid uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_business uuid := public.get_current_business_id();
  v_doc_id bigint;
  v_doc public.warehouse_documents%rowtype;
  v_doc_type text;
  v_prefix text;
  v_number text;
  v_posted jsonb;
  v_line public.warehouse_document_lines%rowtype;
  v_name text;
  v_stock numeric;
  v_unit_cost numeric;
BEGIN
  IF p_type NOT IN ('in', 'out') THEN
    RAISE EXCEPTION 'Tipo de movimiento invalido: %', p_type USING ERRCODE = '22023';
  END IF;
  IF NOT public.has_permission_secure(v_business, 'warehouse.move') THEN
    RAISE EXCEPTION 'No autorizado: requiere permiso warehouse.move' USING ERRCODE = '42501';
  END IF;

  -- Idempotencia outbox: mismo client_uuid → devolver estado actual sin re-postear.
  IF p_client_uuid IS NOT NULL THEN
    SELECT * INTO v_doc
    FROM public.warehouse_documents
    WHERE user_id = v_business AND client_uuid = p_client_uuid;

    IF FOUND THEN
      SELECT * INTO v_line
      FROM public.warehouse_document_lines
      WHERE document_id = v_doc.id
      ORDER BY id
      LIMIT 1;

      SELECT name, stock, avg_cost INTO v_name, v_stock, v_unit_cost
      FROM public.products
      WHERE id = COALESCE(v_line.product_id, p_product_id) AND user_id = v_business;

      RETURN jsonb_build_object(
        'document_id', v_doc.id,
        'doc_number', v_doc.doc_number,
        'product_id', COALESCE(v_line.product_id, p_product_id),
        'qty', COALESCE(v_line.qty, p_qty),
        'type', CASE WHEN v_doc.doc_type = 'quick_in' THEN 'in' ELSE 'out' END,
        'name', v_name,
        'new_stock', v_stock,
        'unit_cost', COALESCE(v_line.unit_cost, v_unit_cost),
        'idempotent', true
      );
    END IF;
  END IF;

  v_doc_type := CASE WHEN p_type = 'in' THEN 'quick_in' ELSE 'quick_out' END;
  v_prefix := CASE WHEN p_type = 'in' THEN 'QIN' ELSE 'QOUT' END;
  v_number := public.next_warehouse_doc_number(v_prefix);

  BEGIN
    INSERT INTO public.warehouse_documents (
      user_id, doc_type, doc_number, status, notes, created_by, client_uuid
    ) VALUES (
      v_business, v_doc_type, v_number, 'draft', p_notes, auth.uid(), p_client_uuid
    ) RETURNING id INTO v_doc_id;
  EXCEPTION
    WHEN unique_violation THEN
      IF p_client_uuid IS NOT NULL THEN
        SELECT * INTO v_doc
        FROM public.warehouse_documents
        WHERE user_id = v_business AND client_uuid = p_client_uuid;
        IF FOUND THEN
          SELECT * INTO v_line
          FROM public.warehouse_document_lines
          WHERE document_id = v_doc.id
          ORDER BY id
          LIMIT 1;

          SELECT name, stock, avg_cost INTO v_name, v_stock, v_unit_cost
          FROM public.products
          WHERE id = COALESCE(v_line.product_id, p_product_id) AND user_id = v_business;

          RETURN jsonb_build_object(
            'document_id', v_doc.id,
            'doc_number', v_doc.doc_number,
            'product_id', COALESCE(v_line.product_id, p_product_id),
            'qty', COALESCE(v_line.qty, p_qty),
            'type', CASE WHEN v_doc.doc_type = 'quick_in' THEN 'in' ELSE 'out' END,
            'name', v_name,
            'new_stock', v_stock,
            'unit_cost', COALESCE(v_line.unit_cost, v_unit_cost),
            'idempotent', true
          );
        END IF;
      END IF;
      RAISE;
  END;

  INSERT INTO public.warehouse_document_lines (document_id, product_id, qty, unit_cost)
  VALUES (v_doc_id, p_product_id, p_qty, CASE WHEN p_type = 'in' THEN p_unit_cost ELSE NULL END);

  v_posted := public.post_warehouse_document(v_doc_id);

  -- Anotar client_uuid en el movimiento creado (si existe la columna).
  IF p_client_uuid IS NOT NULL THEN
    UPDATE public.movements
    SET client_uuid = p_client_uuid
    WHERE document_id = v_doc_id
      AND user_id = v_business
      AND client_uuid IS NULL;
  END IF;

  RETURN v_posted || jsonb_build_object(
    'product_id', p_product_id,
    'qty', p_qty,
    'type', p_type,
    'name', (SELECT name FROM public.products WHERE id = p_product_id AND user_id = v_business),
    'new_stock', (SELECT stock FROM public.products WHERE id = p_product_id AND user_id = v_business),
    'unit_cost', CASE
      WHEN p_type = 'in' THEN p_unit_cost
      ELSE (SELECT avg_cost FROM public.products WHERE id = p_product_id AND user_id = v_business)
    END,
    'doc_number', v_number
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_and_post_quick_movement(bigint, numeric, text, numeric, text, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.create_and_post_quick_movement(bigint, numeric, text, numeric, text, uuid) TO authenticated;
