-- Fix ambiguous function resolution for PostgREST/Supabase RPC.
-- Keep a single canonical signature for public.request_plan_change.

DROP FUNCTION IF EXISTS public.request_plan_change(text, text, text, integer, text, text);

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
EXCEPTION
  WHEN others THEN
    NULL;
END;
$$;

