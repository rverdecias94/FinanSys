-- Add invitation token and expiration to team_members
ALTER TABLE public.team_members
ADD COLUMN IF NOT EXISTS invitation_token uuid DEFAULT gen_random_uuid(),
ADD COLUMN IF NOT EXISTS invitation_expires_at timestamptz DEFAULT (now() + interval '24 hours');

-- Index for faster lookup by token
CREATE INDEX IF NOT EXISTS idx_team_members_token ON public.team_members(invitation_token);

-- Update RLS policies if needed (ensure public can read if they have the token? 
-- Actually, checking by token might need a secure RPC or admin client if RLS is strict.
-- For now, we assume we can query it if we have the token via a secure function or if RLS allows it.)

-- Secure function to validate token and get email
CREATE OR REPLACE FUNCTION public.validate_invitation_token(token_input uuid)
RETURNS TABLE (
  member_email text,
  role_id uuid,
  owner_id uuid,
  status text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT tm.member_email, tm.role_id, tm.owner_id, tm.status
  FROM public.team_members tm
  WHERE tm.invitation_token = token_input
  AND tm.invitation_expires_at > now()
  AND tm.status = 'pending';
END;
$$;
