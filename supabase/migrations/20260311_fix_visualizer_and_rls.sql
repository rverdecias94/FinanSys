-- Migration to fix Visualizer permissions and Team RLS policies

-- 1. Remove 'reports.export' permission from Visualizador role
DO $$
DECLARE
  viewer_role_id uuid;
  export_perm_id uuid;
BEGIN
  SELECT id INTO viewer_role_id FROM public.roles WHERE name = 'Visualizador' AND is_system = true LIMIT 1;
  SELECT id INTO export_perm_id FROM public.permissions WHERE code = 'reports.export' LIMIT 1;

  IF viewer_role_id IS NOT NULL AND export_perm_id IS NOT NULL THEN
    DELETE FROM public.role_permissions 
    WHERE role_id = viewer_role_id AND permission_id = export_perm_id;
  END IF;
END $$;

-- 2. Fix Subscriptions RLS to allow team members to view owner's subscription
DROP POLICY IF EXISTS "Users can view own subscription" ON public.subscriptions;
DROP POLICY IF EXISTS "Users and team members can view subscription" ON public.subscriptions;

CREATE POLICY "Users and team members can view subscription"
ON public.subscriptions
FOR SELECT
USING (
  -- User is the owner
  auth.uid() = user_id 
  OR 
  -- User is an active team member of the owner
  EXISTS (
    SELECT 1 FROM public.team_members 
    WHERE member_id = auth.uid() 
    AND owner_id = subscriptions.user_id
    AND status = 'active'
  )
);

-- Ensure only owners can manage subscriptions
DROP POLICY IF EXISTS "Only owners can manage subscription" ON public.subscriptions;
CREATE POLICY "Only owners can manage subscription"
ON public.subscriptions
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 3. Reinforce RLS for Transactions (Dashboard Data)
-- Just in case previous migrations didn't apply correctly or were overwritten
DROP POLICY IF EXISTS "Owner and Team access transactions" ON public.transactions;

CREATE POLICY "Owner and Team access transactions" ON public.transactions
FOR ALL USING (
  user_id = auth.uid() 
  OR 
  EXISTS (
    SELECT 1 FROM public.team_members 
    WHERE member_id = auth.uid() 
    AND owner_id = transactions.user_id
    AND status = 'active'
  )
);

-- 4. Reinforce RLS for Products
DROP POLICY IF EXISTS "Owner and Team access products" ON public.products;

CREATE POLICY "Owner and Team access products" ON public.products
FOR ALL USING (
  user_id = auth.uid() 
  OR 
  EXISTS (
    SELECT 1 FROM public.team_members 
    WHERE member_id = auth.uid() 
    AND owner_id = products.user_id
    AND status = 'active'
  )
);
