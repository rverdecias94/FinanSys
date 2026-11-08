-- Push Web: suscripciones de dispositivos (admin) + marca anti-duplicado
-- al avisar de un nuevo usuario free.

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT push_subscriptions_user_endpoint UNIQUE (user_id, endpoint)
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id
  ON public.push_subscriptions (user_id);

COMMENT ON TABLE public.push_subscriptions IS
  'Suscripciones Web Push por dispositivo. Solo system_admins se registran en la UI.';

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS push_subscriptions_select_own ON public.push_subscriptions;
CREATE POLICY push_subscriptions_select_own
  ON public.push_subscriptions
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS push_subscriptions_insert_admin ON public.push_subscriptions;
CREATE POLICY push_subscriptions_insert_admin
  ON public.push_subscriptions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND public.is_system_admin()
  );

DROP POLICY IF EXISTS push_subscriptions_update_own ON public.push_subscriptions;
CREATE POLICY push_subscriptions_update_own
  ON public.push_subscriptions
  FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id AND public.is_system_admin())
  WITH CHECK ((SELECT auth.uid()) = user_id AND public.is_system_admin());

DROP POLICY IF EXISTS push_subscriptions_delete_own ON public.push_subscriptions;
CREATE POLICY push_subscriptions_delete_own
  ON public.push_subscriptions
  FOR DELETE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;

-- Evita reenviar el mismo aviso si el cliente reintenta el invoke.
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS admin_new_user_notified_at timestamptz;

COMMENT ON COLUMN public.subscriptions.admin_new_user_notified_at IS
  'Momento en que se envió el push al admin por alta free (null = aún no).';
