-- 1. Secure RPC to accept invitations by email (for Signup flow)
CREATE OR REPLACE FUNCTION public.accept_invitation_by_email(email_input TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with admin privileges to bypass RLS during signup
AS $$
DECLARE
  target_user_id UUID;
  invitation_found BOOLEAN;
BEGIN
  -- Get the ID of the user calling the function (should be the newly created user)
  target_user_id := auth.uid();
  
  IF target_user_id IS NULL THEN
    RETURN FALSE; -- Should not happen if called after signUp
  END IF;

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
      member_id = target_user_id,
      status = 'active',
      updated_at = NOW()
    WHERE member_email = email_input 
    AND status = 'pending';
    
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;

-- 2. Helper function to get the effective business ID for a user
-- If user is owner, returns their own ID.
-- If user is member, returns the owner_id of the team.
CREATE OR REPLACE FUNCTION public.get_effective_business_id(user_uuid UUID)
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  team_owner_id UUID;
BEGIN
  -- Check if user is a member of a team
  SELECT owner_id INTO team_owner_id
  FROM public.team_members
  WHERE member_id = user_uuid
  AND status = 'active'
  LIMIT 1;

  IF team_owner_id IS NOT NULL THEN
    RETURN team_owner_id;
  END IF;

  -- Default to self if not a member
  RETURN user_uuid;
END;
$$;

-- 3. Update RLS Policies for Data Tables to allow Team Access

-- Products
DROP POLICY IF EXISTS "Owner and Team access" ON public.products;
DROP POLICY IF EXISTS "products_read_all" ON public.products; -- Remove generic read all if exists
DROP POLICY IF EXISTS "products_admin_write" ON public.products;
DROP POLICY IF EXISTS "products_admin_update" ON public.products;

CREATE POLICY "Owner and Team access products" ON public.products
FOR ALL
USING (
  user_id = auth.uid() 
  OR 
  EXISTS (
    SELECT 1 FROM public.team_members 
    WHERE member_id = auth.uid() 
    AND owner_id = products.user_id
    AND status = 'active'
  )
);

-- Transactions
DROP POLICY IF EXISTS "transactions_read_own" ON public.transactions;
DROP POLICY IF EXISTS "transactions_insert_own" ON public.transactions;

CREATE POLICY "Owner and Team access transactions" ON public.transactions
FOR ALL
USING (
  user_id = auth.uid() 
  OR 
  EXISTS (
    SELECT 1 FROM public.team_members 
    WHERE member_id = auth.uid() 
    AND owner_id = transactions.user_id
    AND status = 'active'
  )
);

-- Movements
DROP POLICY IF EXISTS "movements_read_own" ON public.movements;
DROP POLICY IF EXISTS "movements_insert_own" ON public.movements;
DROP POLICY IF EXISTS "Users can view their own movements" ON public.movements;
DROP POLICY IF EXISTS "Users can insert their own movements" ON public.movements;
DROP POLICY IF EXISTS "Users can update their own movements" ON public.movements;
DROP POLICY IF EXISTS "Users can delete their own movements" ON public.movements;


CREATE POLICY "Owner and Team access movements" ON public.movements
FOR ALL
USING (
  user_id = auth.uid() 
  OR 
  EXISTS (
    SELECT 1 FROM public.team_members 
    WHERE member_id = auth.uid() 
    AND owner_id = movements.user_id
    AND status = 'active'
  )
);

-- Inventory Areas (if exists)
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'inventory_areas') THEN
    DROP POLICY IF EXISTS "Users can manage their own areas" ON public.inventory_areas;
    
    CREATE POLICY "Owner and Team access areas" ON public.inventory_areas
    FOR ALL
    USING (
      user_id = auth.uid() 
      OR 
      EXISTS (
        SELECT 1 FROM public.team_members 
        WHERE member_id = auth.uid() 
        AND owner_id = inventory_areas.user_id
        AND status = 'active'
      )
    );
  END IF;
END $$;

-- Business Balances
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'business_balances') THEN
    DROP POLICY IF EXISTS "Users can manage their own balances" ON public.business_balances;
    
    CREATE POLICY "Owner and Team access balances" ON public.business_balances
    FOR ALL
    USING (
      user_id = auth.uid() 
      OR 
      EXISTS (
        SELECT 1 FROM public.team_members 
        WHERE member_id = auth.uid() 
        AND owner_id = business_balances.user_id
        AND status = 'active'
      )
    );
  END IF;
END $$;

-- Settings (if user specific)
-- Assuming settings might be global or user specific. If user specific, apply similar logic.

