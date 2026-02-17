-- Migration: Fix RLS Policy for team_members table
-- Created: 2026-02-14
-- Purpose: Fix permission denied error when accessing auth.users

-- Drop the problematic policy that accesses auth.users
DROP POLICY IF EXISTS "Members can view teams they belong to" ON public.team_members;

-- Create a simpler policy that only checks member_id (the UUID reference)
-- This avoids the need to query auth.users directly
CREATE POLICY "Members can view teams they belong to" 
ON public.team_members FOR SELECT 
USING (auth.uid() = member_id);

-- Ensure the owner policy is correctly configured
DROP POLICY IF EXISTS "Owners can manage their team" ON public.team_members;

CREATE POLICY "Owners can manage their team" 
ON public.team_members FOR ALL 
USING (auth.uid() = owner_id);