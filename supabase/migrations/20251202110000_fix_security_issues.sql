-- Fix security issues reported by Supabase

-- 1. Enable RLS on public.proactive_state
alter table if exists public.proactive_state enable row level security;

-- 2. Drop redundant index on public.proactivity_settings
-- The table has identical indexes {idx_proactivity_settings_user_id, proactivity_settings_user_id_key}
-- We keep proactivity_settings_user_id_key as it likely backs the unique constraint
drop index if exists public.idx_proactivity_settings_user_id;

-- 3. Add service_role policies to ensure backend access
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'proactive_state') THEN
        CREATE POLICY "proactive_state_service_role_full_access"
            ON public.proactive_state
            FOR ALL
            TO service_role
            USING (true)
            WITH CHECK (true);
    END IF;
END$$;
