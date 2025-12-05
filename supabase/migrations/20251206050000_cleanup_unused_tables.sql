-- Supabase Cleanup Migration
-- Remove unused tables to simplify schema (auth-only focus)
-- These tables are either:
--   1. Never used in code (0 references)
--   2. Replaced by local SQLite storage

-- Legacy conversation tables (replaced by user_chat_threads/user_chat_messages)
drop table if exists public.conversation_messages cascade;
drop table if exists public.conversations cascade;

-- Timezone cache (not needed, was for UI optimization)
drop table if exists public.timezone_names_cache cascade;
drop function if exists public.refresh_timezone_names_cache() cascade;
drop function if exists public.get_cached_timezone_names() cascade;

-- Clean up any orphaned RLS policies
-- (policies are automatically dropped with tables via CASCADE)
