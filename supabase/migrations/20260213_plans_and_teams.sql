-- Migration: Plans, Subscriptions, and Teams
-- Created: 2026-02-13

-- 1. Plans Table
CREATE TABLE IF NOT EXISTS public.plans (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    price_monthly DECIMAL(10, 2) DEFAULT 0,
    features JSONB NOT NULL,
    limits JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert Default Plans
INSERT INTO public.plans (id, name, price_monthly, features, limits)
VALUES 
('free', 'Plan Gratuito', 0, 
    '{"reports_export": false, "audit_logs": false, "custom_branding": false}', 
    '{"monthly_transactions": 50, "partners": 0, "products": 50}'
),
('premium', 'Plan Premium', 29.99, 
    '{"reports_export": true, "audit_logs": true, "custom_branding": true}', 
    '{"monthly_transactions": -1, "partners": 5, "products": -1}' -- -1 means unlimited
)
ON CONFLICT (id) DO NOTHING;

-- 2. Subscriptions Table
CREATE TABLE IF NOT EXISTS public.subscriptions (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    plan_id TEXT REFERENCES public.plans(id) DEFAULT 'free',
    status TEXT DEFAULT 'active', -- active, trial, past_due, cancelled
    trial_start_at TIMESTAMPTZ,
    trial_end_at TIMESTAMPTZ,
    current_period_start TIMESTAMPTZ DEFAULT NOW(),
    current_period_end TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on subscriptions
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscription" 
ON public.subscriptions FOR SELECT 
USING (auth.uid() = user_id);

-- 3. Team Members Table (for Premium Partners)
CREATE TABLE IF NOT EXISTS public.team_members (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    member_email TEXT NOT NULL,
    member_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- Can be null if invited but not registered
    role TEXT DEFAULT 'editor', -- admin, editor, viewer
    status TEXT DEFAULT 'pending', -- pending, accepted
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(owner_id, member_email)
);

-- Enable RLS on team_members
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage their team" 
ON public.team_members FOR ALL 
USING (auth.uid() = owner_id);

CREATE POLICY "Members can view teams they belong to" 
ON public.team_members FOR SELECT 
USING (auth.uid() = member_id OR member_email = (SELECT email FROM auth.users WHERE id = auth.uid()));

-- 4. Usage Metrics Table (to track monthly usage)
CREATE TABLE IF NOT EXISTS public.usage_metrics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    metric_key TEXT NOT NULL, -- 'transactions_almacen', 'transactions_finanzas'
    count INTEGER DEFAULT 0,
    period_start TIMESTAMPTZ NOT NULL, -- First day of month
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, metric_key, period_start)
);

-- Enable RLS on usage_metrics
ALTER TABLE public.usage_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own usage" 
ON public.usage_metrics FOR SELECT 
USING (auth.uid() = user_id);

-- 5. Audit Logs (for Premium)
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    action TEXT NOT NULL,
    resource TEXT NOT NULL,
    details JSONB,
    ip_address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own audit logs" 
ON public.audit_logs FOR SELECT 
USING (auth.uid() = user_id);

-- 6. Helper Functions for Plan Checks

-- Function to check if user is premium or in trial
CREATE OR REPLACE FUNCTION is_premium(check_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    sub record;
BEGIN
    SELECT * INTO sub FROM public.subscriptions WHERE user_id = check_user_id;
    
    IF sub.plan_id = 'premium' AND sub.status = 'active' THEN
        RETURN TRUE;
    END IF;
    
    -- Check Trial
    IF sub.status = 'trial' AND sub.trial_end_at > NOW() THEN
        RETURN TRUE;
    END IF;
    
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to increment usage safely
CREATE OR REPLACE FUNCTION increment_usage(p_user_id UUID, p_metric_key TEXT)
RETURNS VOID AS $$
DECLARE
    p_start TIMESTAMPTZ;
BEGIN
    p_start := date_trunc('month', NOW());
    
    INSERT INTO public.usage_metrics (user_id, metric_key, period_start, count)
    VALUES (p_user_id, p_metric_key, p_start, 1)
    ON CONFLICT (user_id, metric_key, period_start)
    DO UPDATE SET count = usage_metrics.count + 1, last_updated = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Updated RLS for Data Tables (Example for Products)
-- We need to allow Team Members to access Owner's data
-- Note: This requires dropping existing policies first in a real migration, 
-- but here we define the logic.

-- Example Policy for Products (Conceptual - user must apply manually or via script)
/*
CREATE POLICY "Owner and Team access" ON public.products
FOR ALL
USING (
    user_id = auth.uid() 
    OR 
    exists (
        select 1 from public.team_members 
        where member_id = auth.uid() 
        and owner_id = products.user_id
        and status = 'accepted'
    )
);
*/
