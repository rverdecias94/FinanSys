-- ============================================================================
-- Historial de conversaciones del Asistente Ultra (por negocio).
-- Idempotente.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.ai_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Nueva conversación',
  messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_conversations_title_len CHECK (char_length(title) BETWEEN 1 AND 200),
  CONSTRAINT ai_conversations_messages_is_array CHECK (jsonb_typeof(messages) = 'array')
);

CREATE INDEX IF NOT EXISTS idx_ai_conversations_business_updated
  ON public.ai_conversations (business_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_conversations_user
  ON public.ai_conversations (user_id, updated_at DESC);

ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_conversations_select ON public.ai_conversations;
CREATE POLICY ai_conversations_select ON public.ai_conversations
FOR SELECT TO authenticated
USING (
  auth.uid() = business_id
  OR public.is_member_of_team(business_id)
  OR public.is_system_admin()
);

DROP POLICY IF EXISTS ai_conversations_insert ON public.ai_conversations;
CREATE POLICY ai_conversations_insert ON public.ai_conversations
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND (
    auth.uid() = business_id
    OR public.is_member_of_team(business_id)
  )
);

DROP POLICY IF EXISTS ai_conversations_update ON public.ai_conversations;
CREATE POLICY ai_conversations_update ON public.ai_conversations
FOR UPDATE TO authenticated
USING (
  auth.uid() = user_id
  AND (auth.uid() = business_id OR public.is_member_of_team(business_id))
)
WITH CHECK (
  auth.uid() = user_id
  AND (auth.uid() = business_id OR public.is_member_of_team(business_id))
);

DROP POLICY IF EXISTS ai_conversations_delete ON public.ai_conversations;
CREATE POLICY ai_conversations_delete ON public.ai_conversations
FOR DELETE TO authenticated
USING (
  auth.uid() = user_id
  OR auth.uid() = business_id
  OR public.is_system_admin()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_conversations TO authenticated;

CREATE OR REPLACE FUNCTION public.touch_ai_conversation_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ai_conversations_updated ON public.ai_conversations;
CREATE TRIGGER trg_ai_conversations_updated
BEFORE UPDATE ON public.ai_conversations
FOR EACH ROW
EXECUTE FUNCTION public.touch_ai_conversation_updated_at();
