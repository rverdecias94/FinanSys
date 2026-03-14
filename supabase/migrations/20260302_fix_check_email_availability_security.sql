CREATE OR REPLACE FUNCTION public.check_email_availability(email_input TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  target_user_id UUID;
  is_owner BOOLEAN;
  is_member BOOLEAN;
BEGIN
  SELECT id INTO target_user_id 
  FROM auth.users 
  WHERE email = email_input;

  IF target_user_id IS NOT NULL THEN
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

    SELECT EXISTS(
      SELECT 1 FROM public.team_members 
      WHERE (member_email = email_input OR member_id = target_user_id)
      AND status IN ('pending', 'active')
    ) INTO is_member;

    RETURN NOT (is_owner OR is_member);
  ELSE
    RETURN NOT EXISTS(
      SELECT 1 FROM public.team_members 
      WHERE member_email = email_input 
      AND status IN ('pending', 'active')
    );
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_email_availability(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_email_availability(TEXT) TO service_role;
