-- =============================================================================
-- SUPABASE AUTH-ONLY CLEANUP (DESTRUCTIVE, EXPLICIT OPT-IN)
-- =============================================================================
-- This migration is now guarded and does nothing by default.
--
-- To run destructive cleanup intentionally, set the Postgres setting below in
-- the same session before applying migrations:
--   SELECT set_config('app.supabase_cleanup_confirmed', 'true', false);
-- =============================================================================

do $$
begin
    if coalesce(current_setting('app.supabase_cleanup_confirmed', true), 'false') <> 'true' then
        raise notice 'Skipping destructive Supabase cleanup migration (app.supabase_cleanup_confirmed != true).';
        return;
    end if;

    if current_user not in ('supabase_admin', 'postgres') then
        raise notice 'Skipping destructive Supabase cleanup migration (current_user is not privileged).';
        return;
    end if;

    -- Chat/messaging tables
    drop table if exists public.user_chat_messages cascade;
    drop table if exists public.general_chat_messages cascade;
    drop table if exists public.user_chat_threads cascade;
    drop table if exists public.conversation_messages cascade;
    drop table if exists public.conversations cascade;
    drop table if exists public.chat_sessions cascade;

    -- User data tables
    drop table if exists public.user_data cascade;
    drop table if exists public.user_streaks cascade;
    drop table if exists public.users cascade;

    -- Plans/habits/reminders
    drop table if exists public.plans cascade;
    drop table if exists public.habits cascade;
    drop table if exists public.reminders cascade;

    -- Proactivity tables
    drop table if exists public.proactivity_settings cascade;
    drop table if exists public.proactive_notifications cascade;
    drop table if exists public.proactivity_logs cascade;
    drop table if exists public.proactivity_push_subscriptions cascade;

    -- Dashboard/calendar tables
    drop table if exists public.dashboard_pulses cascade;
    drop table if exists public.calendars cascade;
    drop table if exists public.calendar_events cascade;

    -- Utility tables
    drop table if exists public.context_cache cascade;
    drop table if exists public.file_search_stores cascade;
    drop table if exists public.media_uploads cascade;
    drop table if exists public.timezone_names_cache cascade;

    -- Associated functions
    drop function if exists public.refresh_timezone_names_cache() cascade;
    drop function if exists public.get_cached_timezone_names() cascade;
end $$;
