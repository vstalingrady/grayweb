-- =============================================================================
-- SUPABASE AUTH-ONLY MIGRATION (2025-12-06)
-- =============================================================================
-- This migration removes ALL data tables from Supabase.
-- Supabase is now used ONLY for authentication (auth.users).
-- All application data is stored in local SQLite.
-- 
-- WARNING: This is a DESTRUCTIVE migration. All data in these tables will be lost.
-- Ensure you have backed up any needed data before running this.
-- =============================================================================

-- Drop all application data tables (in dependency order)

-- Chat/messaging tables
DROP TABLE IF EXISTS public.user_chat_messages CASCADE;
DROP TABLE IF EXISTS public.general_chat_messages CASCADE;
DROP TABLE IF EXISTS public.user_chat_threads CASCADE;
DROP TABLE IF EXISTS public.conversation_messages CASCADE;
DROP TABLE IF EXISTS public.conversations CASCADE;
DROP TABLE IF EXISTS public.chat_sessions CASCADE;

-- User data tables  
DROP TABLE IF EXISTS public.user_data CASCADE;
DROP TABLE IF EXISTS public.user_streaks CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- Plans/habits/reminders
DROP TABLE IF EXISTS public.plans CASCADE;
DROP TABLE IF EXISTS public.habits CASCADE;
DROP TABLE IF EXISTS public.reminders CASCADE;

-- Proactivity tables
DROP TABLE IF EXISTS public.proactivity_settings CASCADE;
DROP TABLE IF EXISTS public.proactive_notifications CASCADE;
DROP TABLE IF EXISTS public.proactivity_logs CASCADE;
DROP TABLE IF EXISTS public.proactivity_push_subscriptions CASCADE;

-- Dashboard/calendar tables
DROP TABLE IF EXISTS public.dashboard_pulses CASCADE;
DROP TABLE IF EXISTS public.calendars CASCADE;
DROP TABLE IF EXISTS public.calendar_events CASCADE;

-- Utility tables
DROP TABLE IF EXISTS public.context_cache CASCADE;
DROP TABLE IF EXISTS public.file_search_stores CASCADE;
DROP TABLE IF EXISTS public.media_uploads CASCADE;
DROP TABLE IF EXISTS public.timezone_names_cache CASCADE;

-- Drop any associated functions
DROP FUNCTION IF EXISTS public.refresh_timezone_names_cache() CASCADE;
DROP FUNCTION IF EXISTS public.get_cached_timezone_names() CASCADE;

-- =============================================================================
-- Supabase is now auth-only. The auth.users table is managed by Supabase Auth
-- and should NOT be touched by this migration.
-- =============================================================================
