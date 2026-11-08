-- Aviso push al admin cuando se crea una suscripción free.
-- No depende del cliente (evita la carrera Login vs SubscriptionContext).

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE SCHEMA IF NOT EXISTS private;

CREATE TABLE IF NOT EXISTS private.push_hook_config (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  hook_secret text NOT NULL,
  function_url text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE private.push_hook_config FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.notify_admins_on_free_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, private
AS $$
DECLARE
  conf private.push_hook_config%ROWTYPE;
  email text;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RETURN NEW;
  END IF;
  IF NEW.plan_id IS DISTINCT FROM 'free' THEN
    RETURN NEW;
  END IF;

  SELECT * INTO conf FROM private.push_hook_config WHERE id = 1;
  IF NOT FOUND THEN
    -- Sin secreto configurado aún: no fallar el alta del usuario.
    RETURN NEW;
  END IF;

  SELECT u.email INTO email
  FROM auth.users u
  WHERE u.id = NEW.user_id;

  PERFORM net.http_post(
    url := conf.function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-push-hook-secret', conf.hook_secret
    ),
    body := jsonb_build_object(
      'user_id', NEW.user_id,
      'email', email,
      'plan_id', NEW.plan_id,
      'source', 'db_trigger'
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_admins_free_subscription ON public.subscriptions;
CREATE TRIGGER trg_notify_admins_free_subscription
  AFTER INSERT ON public.subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admins_on_free_subscription();

COMMENT ON FUNCTION public.notify_admins_on_free_subscription() IS
  'Tras INSERT free en subscriptions, llama a la Edge Function notify-admin-new-user.';
