-- Fix security issues reported by Supabase

-- 1. Enable RLS on public.proactive_state
alter table if exists public.proactive_state enable row level security;

-- 2. Ensure per-user uniqueness on public.proactivity_settings.
-- Keep/create a unique index instead of dropping it blindly.
create unique index if not exists idx_proactivity_settings_user_id
    on public.proactivity_settings (user_id);

-- 3. Add service_role policies to ensure backend access
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'proactive_state')
       AND NOT EXISTS (
           SELECT 1 FROM pg_policies
           WHERE schemaname = 'public'
             AND tablename = 'proactive_state'
             AND policyname = 'proactive_state_service_role_full_access'
       ) THEN
        CREATE POLICY "proactive_state_service_role_full_access"
            ON public.proactive_state
            FOR ALL
            TO service_role
            USING (true)
            WITH CHECK (true);
    END IF;
END$$;
