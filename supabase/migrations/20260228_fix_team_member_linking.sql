-- Add member_id column to team_members to link with auth.users
ALTER TABLE public.team_members
ADD COLUMN IF NOT EXISTS member_id UUID REFERENCES auth.users(id);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_team_members_member_id ON public.team_members(member_id);
CREATE INDEX IF NOT EXISTS idx_team_members_email ON public.team_members(member_email);

-- Update the check_email_availability function to be more robust
CREATE OR REPLACE FUNCTION public.check_email_availability(email_input TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  target_user_id UUID;
  is_owner BOOLEAN;
  is_member BOOLEAN;
BEGIN
  -- Check if email exists as a registered user
  SELECT id INTO target_user_id 
  FROM auth.users 
  WHERE email = email_input;

  IF target_user_id IS NOT NULL THEN
    -- User exists, check if they're an owner (has any data in the system)
    SELECT EXISTS(
      SELECT 1 FROM public.products WHERE user_id = target_user_id
      UNION ALL
      SELECT 1 FROM public.transactions WHERE user_id = target_user_id
      UNION ALL
      SELECT 1 FROM public.movements WHERE user_id = target_user_id
      UNION ALL
      SELECT 1 FROM public.inventory_areas WHERE user_id = target_user_id
      LIMIT 1
    ) INTO is_owner;

    -- Check if they're already a team member anywhere
    SELECT EXISTS(
      SELECT 1 FROM public.team_members 
      WHERE (member_email = email_input OR member_id = target_user_id)
      AND status IN ('pending', 'active')
    ) INTO is_member;

    -- Email is NOT available if:
    -- 1. User is an owner (has their own business), OR
    -- 2. User is already a member of some team
    RETURN NOT (is_owner OR is_member);
  ELSE
    -- Email doesn't exist as user yet, check if it's already invited
    RETURN NOT EXISTS(
      SELECT 1 FROM public.team_members 
      WHERE member_email = email_input 
      AND status IN ('pending', 'active')
    );
  END IF;
END;
$$;

-- Create a function to get user's business context
CREATE OR REPLACE FUNCTION public.get_user_business_context(user_uuid UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
  team_record RECORD;
BEGIN
  -- Check if user is a team member
  SELECT owner_id, role_id, status INTO team_record
  FROM public.team_members
  WHERE member_id = user_uuid 
  AND status = 'active'
  LIMIT 1;

  IF team_record IS NOT NULL THEN
    -- User is a team member
    SELECT jsonb_build_object(
      'businessId', team_record.owner_id,
      'isOwner', false,
      'roleId', team_record.role_id,
      'permissions', COALESCE(
        (SELECT jsonb_agg(p.code)
         FROM public.role_permissions rp
         JOIN public.permissions p ON p.id = rp.permission_id
         WHERE rp.role_id = team_record.role_id), 
        '[]'::jsonb
      )
    ) INTO result;
    RETURN result;
  END IF;

  -- Check if user is an owner (has their own data)
  IF EXISTS(
    SELECT 1 FROM public.products WHERE user_id = user_uuid LIMIT 1
    UNION ALL
    SELECT 1 FROM public.transactions WHERE user_id = user_uuid LIMIT 1
    UNION ALL  
    SELECT 1 FROM public.movements WHERE user_id = user_uuid LIMIT 1
    UNION ALL
    SELECT 1 FROM public.inventory_areas WHERE user_id = user_uuid LIMIT 1
  ) THEN
    SELECT jsonb_build_object(
      'businessId', user_uuid,
      'isOwner', true,
      'roleId', null,
      'permissions', '["*"]'::jsonb
    ) INTO result;
    RETURN result;
  END IF;

  -- User has no business context
  SELECT jsonb_build_object(
    'businessId', user_uuid,
    'isOwner', false,
    'roleId', null,
    'permissions', '[]'::jsonb
  ) INTO result;
  RETURN result;
END;
$$;

-- Create a secure function to accept invitations
CREATE OR REPLACE FUNCTION public.accept_invitation_secure(email_input TEXT, user_uuid UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  invitation_record RECORD;
  result JSONB;
BEGIN
  -- Find pending invitation
  SELECT id, owner_id, role_id INTO invitation_record
  FROM public.team_members
  WHERE member_email = email_input 
  AND status = 'pending'
  LIMIT 1;

  IF invitation_record IS NOT NULL THEN
    -- Accept the invitation
    UPDATE public.team_members
    SET 
      member_id = user_uuid,
      status = 'active',
      updated_at = NOW()
    WHERE id = invitation_record.id;

    -- Return business context
    SELECT jsonb_build_object(
      'businessId', invitation_record.owner_id,
      'isOwner', false,
      'roleId', invitation_record.role_id,
      'permissions', COALESCE(
        (SELECT jsonb_agg(p.code)
         FROM public.role_permissions rp
         JOIN public.permissions p ON p.id = rp.permission_id
         WHERE rp.role_id = invitation_record.role_id), 
        '[]'::jsonb
      )
    ) INTO result;
    RETURN result;
  END IF;

  -- No invitation found
  RETURN NULL;
END;
$$;
