-- Create a better version of accept_invitation_by_email that takes user_id as parameter
-- This avoids relying on auth.uid() which might not work reliably during signup
CREATE OR REPLACE FUNCTION public.accept_invitation_by_email_with_user(email_input TEXT, user_uuid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with admin privileges to bypass RLS during signup
AS $$
DECLARE
  invitation_found BOOLEAN;
BEGIN
  -- Check if there are pending invitations
  SELECT EXISTS(
    SELECT 1 FROM public.team_members 
    WHERE member_email = email_input 
    AND status = 'pending'
  ) INTO invitation_found;

  IF invitation_found THEN
    -- Update the invitation: link to user_id and set status to active
    UPDATE public.team_members
    SET 
      member_id = user_uuid,
      status = 'active',
      updated_at = NOW()
    WHERE member_email = email_input 
    AND status = 'pending';
    
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;

-- Update the acceptPendingInvitations function to use the new function
-- This will be done in the application code, not here