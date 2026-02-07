ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS details JSONB DEFAULT '{}'::jsonb;
