-- Fix RLS policies for team_members table to ensure owners can invite members
-- This overrides any previous conflicting policies

-- Enable RLS just in case
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies to ensure a clean slate
DROP POLICY IF EXISTS "Owners can manage their team" ON public.team_members;
DROP POLICY IF EXISTS "Members can view teams they belong to" ON public.team_members;
DROP POLICY IF EXISTS "Public can view team members" ON public.team_members;
DROP POLICY IF EXISTS "view_team_members" ON public.team_members;
DROP POLICY IF EXISTS "manage_team_members" ON public.team_members;
DROP POLICY IF EXISTS "Members can view their own membership" ON public.team_members;

-- Policy 1: Owners can do EVERYTHING on their own team members
-- This includes INSERT, SELECT, UPDATE, DELETE
-- Condition: The owner_id of the record must match the authenticated user's ID
CREATE POLICY "Owners can manage their team"
ON public.team_members
FOR ALL
USING (auth.uid() = owner_id);

-- Policy 2: Members can view their own membership record
-- This allows them to see which team they belong to
CREATE POLICY "Members can view their own membership"
ON public.team_members
FOR SELECT
USING (auth.uid() = member_id);

-- Policy 3: Members can view other members of the SAME team
-- This is useful for team collaboration features (seeing who else is on the team)
-- We check if the current user (auth.uid()) is a member of the same team (same owner_id)
CREATE POLICY "Members can view team colleagues"
ON public.team_members
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.member_id = auth.uid()
    AND tm.owner_id = team_members.owner_id
    AND tm.status = 'active'
  )
);

-- Ensure authenticated users have permission to use the table
GRANT ALL ON public.team_members TO authenticated;
GRANT ALL ON public.team_members TO service_role;
