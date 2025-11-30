-- Fix security issues reported by Supabase

-- 1. Enable RLS on public.google_calendar_states
alter table if exists public.google_calendar_states enable row level security;

-- 2. Enable RLS on public.proactive_state
alter table if exists public.proactive_state enable row level security;

-- 3. Drop redundant index on public.proactivity_settings
-- The table has identical indexes {idx_proactivity_settings_user_id, proactivity_settings_user_id_key}
-- We keep proactivity_settings_user_id_key as it likely backs the unique constraint
drop index if exists public.idx_proactivity_settings_user_id;

-- 4. Add service_role policies to ensure backend access
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'google_calendar_states') THEN
        CREATE POLICY "google_calendar_states_service_role_full_access"
            ON public.google_calendar_states
            FOR ALL
            TO service_role
            USING (true)
            WITH CHECK (true);
    END IF;
END$$;

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
