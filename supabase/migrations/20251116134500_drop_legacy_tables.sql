-- Remove legacy tables that were only used by the deprecated Discord bot layer.
-- This keeps the Supabase schema focused on the Next.js/FastAPI app.

drop table if exists public.pinned_messages cascade;
drop table if exists public.user_profiles cascade;
drop table if exists public.user_api_keys cascade;
drop table if exists public.user_servers cascade;
drop table if exists public.user_goals cascade;
drop table if exists public.user_habits cascade;
drop table if exists public.checkin_preferences cascade;
drop table if exists public.checkin_settings cascade;
drop table if exists public.checkin_events cascade;
drop table if exists public.proactive_state cascade;
drop table if exists public.user_workspaces cascade;
drop table if exists public.workspace_files cascade;
drop table if exists public.memories cascade;
drop table if exists public.system_prompts cascade;
drop table if exists public.guild_preferences cascade;
drop table if exists public.dashboard_daily cascade;
drop table if exists public.dashboard_constitution cascade;
drop table if exists public.conversation_history cascade;
