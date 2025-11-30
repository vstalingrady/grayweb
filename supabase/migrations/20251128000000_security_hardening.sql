-- Security Hardening Migration
-- Fixes mutable search paths and missing RLS policies

-- 1. Fix mutable search paths for functions
-- This prevents malicious code from executing with the privileges of the function owner
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'get_rolling_memory_stats') THEN
        ALTER FUNCTION public.get_rolling_memory_stats(BIGINT) SET search_path = public, pg_temp;
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'cleanup_old_archived_messages') THEN
        ALTER FUNCTION public.cleanup_old_archived_messages(INTEGER) SET search_path = public, pg_temp;
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'update_updated_at_column') THEN
        ALTER FUNCTION public.update_updated_at_column() SET search_path = public, pg_temp;
    END IF;
END $$;


-- 2. Add missing RLS policy for workspace_backgrounds
-- The table has RLS enabled but no policies, which denies all access by default.
-- We add a policy to allow authenticated users to read backgrounds.
DO $$
BEGIN
    -- Check if table exists first to avoid errors if it was deleted
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'workspace_backgrounds') THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies
            WHERE schemaname = 'public'
              AND tablename = 'workspace_backgrounds'
              AND policyname = 'Enable read access for authenticated users'
        ) THEN
            CREATE POLICY "Enable read access for authenticated users"
                ON public.workspace_backgrounds
                FOR SELECT
                TO authenticated
                USING (true);
        END IF;
    END IF;
END $$;
