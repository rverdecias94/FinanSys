-- Fix infinite recursion in RLS policies for team_members table
-- The previous policy "Members can view team colleagues" caused recursion when querying team_members

-- 1. Create a secure function to check team membership
-- This function runs with SECURITY DEFINER to bypass RLS recursion
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

-- Grant execution permission
GRANT EXECUTE ON FUNCTION public.is_member_of_team TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_member_of_team TO service_role;

-- 2. Drop the recursive policy
DROP POLICY IF EXISTS "Members can view team colleagues" ON public.team_members;

-- 3. Re-create the policy using the secure function
-- This allows members to view rows of other members in the same team without triggering recursion
CREATE POLICY "Members can view team colleagues"
ON public.team_members
FOR SELECT
USING (
  public.is_member_of_team(owner_id)
);

-- 4. Verify other policies (idempotent)
DROP POLICY IF EXISTS "Owners can manage their team" ON public.team_members;
CREATE POLICY "Owners can manage their team"
ON public.team_members
FOR ALL
USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Members can view their own membership" ON public.team_members;
CREATE POLICY "Members can view their own membership"
ON public.team_members
FOR SELECT
USING (auth.uid() = member_id);
