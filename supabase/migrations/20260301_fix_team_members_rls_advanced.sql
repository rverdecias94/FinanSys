-- Advanced RLS for team_members to allow Owners AND Admins to manage the team
-- This replaces the simple "Owners only" policy with a permission-based check

-- 1. Ensure is_member_of_team exists (from recursion fix)
CREATE OR REPLACE FUNCTION public.is_member_of_team(target_owner_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM public.team_members 
    WHERE member_id = auth.uid() 
    AND owner_id = target_owner_id 
    AND status = 'active'
  );
END;
$$;

-- 2. Create helper function to check permission
-- This function is SECURITY DEFINER to bypass RLS and avoid infinite recursion
CREATE OR REPLACE FUNCTION public.has_permission_secure(target_owner_id UUID, perm_code TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  -- 1. Owner always has permission
  IF auth.uid() = target_owner_id THEN
    RETURN TRUE;
  END IF;

  -- 2. Check if user is an active team member with the required permission
  -- We query team_members -> role_permissions -> permissions
  RETURN EXISTS (
    SELECT 1
    FROM public.team_members tm
    JOIN public.role_permissions rp ON tm.role_id = rp.role_id
    JOIN public.permissions p ON rp.permission_id = p.id
    WHERE tm.member_id = auth.uid()
    AND tm.owner_id = target_owner_id
    AND tm.status = 'active'
    AND p.code = perm_code
  );
END;
$$;

-- Grant execution to authenticated users
GRANT EXECUTE ON FUNCTION public.has_permission_secure TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_permission_secure TO service_role;
GRANT EXECUTE ON FUNCTION public.is_member_of_team TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_member_of_team TO service_role;

-- 3. Drop existing restrictive policies
DROP POLICY IF EXISTS "Owners can manage their team" ON public.team_members;
DROP POLICY IF EXISTS "Manage team members" ON public.team_members;
DROP POLICY IF EXISTS "Members can view team colleagues" ON public.team_members;
DROP POLICY IF EXISTS "Members can view their own membership" ON public.team_members;


-- 4. Create the new permissive policy for management (INSERT, UPDATE, DELETE)
-- Allows Owners AND Admins (users with 'team.manage' permission)
CREATE POLICY "Manage team members"
ON public.team_members
FOR ALL
USING (
  public.has_permission_secure(owner_id, 'team.manage')
);

-- 5. Members can view their own membership record
CREATE POLICY "Members can view their own membership"
ON public.team_members
FOR SELECT
USING (auth.uid() = member_id);

-- 6. Members can view their colleagues (using the secure function)
CREATE POLICY "Members can view team colleagues"
ON public.team_members
FOR SELECT
USING (
  public.is_member_of_team(owner_id)
);

-- 7. Ensure authenticated users have permission to use the table
GRANT ALL ON public.team_members TO authenticated;
GRANT ALL ON public.team_members TO service_role;
