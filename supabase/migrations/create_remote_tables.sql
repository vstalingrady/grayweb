-- Add missing columns to existing users table for dual database setup
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/uxdcobkmacieegddygyr/sql

DO $$ 
BEGIN
    -- Add auth_user_id if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'users' 
                   AND column_name = 'auth_user_id') THEN
        ALTER TABLE public.users ADD COLUMN auth_user_id UUID UNIQUE;
    END IF;

    -- Add other missing columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'workspace_background_id') THEN
        ALTER TABLE public.users ADD COLUMN workspace_background_id TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'maps_enabled') THEN
        ALTER TABLE public.users ADD COLUMN maps_enabled BOOLEAN DEFAULT FALSE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'personalization_nickname') THEN
        ALTER TABLE public.users ADD COLUMN personalization_nickname TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'personalization_occupation') THEN
        ALTER TABLE public.users ADD COLUMN personalization_occupation TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'personalization_about') THEN
        ALTER TABLE public.users ADD COLUMN personalization_about TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'personalization_custom_instructions') THEN
        ALTER TABLE public.users ADD COLUMN personalization_custom_instructions TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'has_seen_general_chat') THEN
        ALTER TABLE public.users ADD COLUMN has_seen_general_chat BOOLEAN DEFAULT FALSE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'daily_token_usage') THEN
        ALTER TABLE public.users ADD COLUMN daily_token_usage INTEGER DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'monthly_cost_usage') THEN
        ALTER TABLE public.users ADD COLUMN monthly_cost_usage REAL DEFAULT 0.0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'weekly_cost_usage') THEN
        ALTER TABLE public.users ADD COLUMN weekly_cost_usage REAL DEFAULT 0.0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'six_hour_cost_usage') THEN
        ALTER TABLE public.users ADD COLUMN six_hour_cost_usage REAL DEFAULT 0.0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'last_daily_reset') THEN
        ALTER TABLE public.users ADD COLUMN last_daily_reset TIMESTAMPTZ;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'last_monthly_reset') THEN
        ALTER TABLE public.users ADD COLUMN last_monthly_reset TIMESTAMPTZ;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'last_weekly_reset') THEN
        ALTER TABLE public.users ADD COLUMN last_weekly_reset TIMESTAMPTZ;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'last_six_hour_reset') THEN
        ALTER TABLE public.users ADD COLUMN last_six_hour_reset TIMESTAMPTZ;
    END IF;
END $$;

-- Create other tables
CREATE TABLE IF NOT EXISTS public.user_streaks (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
    current_streak INTEGER DEFAULT 0,
    last_activity_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.proactivity_push_subscriptions (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    endpoint TEXT UNIQUE NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.google_calendar_credentials (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    token_uri TEXT NOT NULL,
    client_id TEXT NOT NULL,
    client_secret TEXT NOT NULL,
    scopes TEXT NOT NULL,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_users_auth_user_id ON public.users(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_user_streaks_user_id ON public.user_streaks(user_id);
CREATE INDEX IF NOT EXISTS idx_proactivity_push_user_id ON public.proactivity_push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_google_calendar_user_id ON public.google_calendar_credentials(user_id);

-- Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_streaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proactivity_push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_calendar_credentials ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "users_service_role_full_access" ON public.users;
DROP POLICY IF EXISTS "user_streaks_service_role_full_access" ON public.user_streaks;
DROP POLICY IF EXISTS "proactivity_push_service_role_full_access" ON public.proactivity_push_subscriptions;
DROP POLICY IF EXISTS "google_calendar_service_role_full_access" ON public.google_calendar_credentials;

-- Create service role policies (backend full access)
CREATE POLICY "users_service_role_full_access" ON public.users FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "user_streaks_service_role_full_access" ON public.user_streaks FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "proactivity_push_service_role_full_access" ON public.proactivity_push_subscriptions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "google_calendar_service_role_full_access" ON public.google_calendar_credentials FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Create update trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column() RETURNS TRIGGER AS $$ 
BEGIN 
    NEW.updated_at = NOW(); 
    RETURN NEW; 
END; 
$$ LANGUAGE plpgsql;

-- Create triggers
DROP TRIGGER IF EXISTS update_users_updated_at ON public.users;
DROP TRIGGER IF EXISTS update_user_streaks_updated_at ON public.user_streaks;
DROP TRIGGER IF EXISTS update_proactivity_push_updated_at ON public.proactivity_push_subscriptions;
DROP TRIGGER IF EXISTS update_google_calendar_updated_at ON public.google_calendar_credentials;

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_streaks_updated_at BEFORE UPDATE ON public.user_streaks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_proactivity_push_updated_at BEFORE UPDATE ON public.proactivity_push_subscriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_google_calendar_updated_at BEFORE UPDATE ON public.google_calendar_credentials FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

SELECT 'Remote database migration completed successfully!' AS status;
