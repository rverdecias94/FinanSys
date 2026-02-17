-- Migration: Fix RLS Policy for team_members table
-- Created: 2026-02-14
-- Purpose: Fix permission denied error when accessing auth.users

-- Drop the problematic policy that accesses auth.users
DROP POLICY IF EXISTS "Members can view teams they belong to" ON public.team_members;

-- Create a safer policy that doesn't directly query auth.users
-- Instead, we check if the current user's email matches the member_email
CREATE POLICY "Members can view teams they belong to" 
ON public.team_members FOR SELECT 
USING (
    auth.uid() = member_id 
    OR 
    member_email = auth.email()
);

-- Alternative: Create a function to safely check user email
CREATE OR REPLACE FUNCTION get_current_user_email()
RETURNS TEXT AS $$
BEGIN
    RETURN auth.email();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the policy to use the function
DROP POLICY IF EXISTS "Members can view teams they belong to" ON public.team_members;

CREATE POLICY "Members can view teams they belong to" 
ON public.team_members FOR SELECT 
USING (
    auth.uid() = member_id 
    OR 
    member_email = get_current_user_email()
);

-- Also ensure the insert policy is correct for inviting members
-- The owner should be able to insert new team members
DROP POLICY IF EXISTS "Owners can manage their team" ON public.team_members;

CREATE POLICY "Owners can manage their team" 
ON public.team_members FOR ALL 
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);

-- Create a specific policy for inserting new team members
CREATE POLICY "Owners can invite team members" 
ON public.team_members FOR INSERT 
WITH CHECK (auth.uid() = owner_id);