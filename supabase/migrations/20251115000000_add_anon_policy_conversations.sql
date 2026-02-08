-- Security hardening: never grant broad anon access to conversations.
-- Keep backend access scoped to service_role policies.
drop policy if exists "conversations_anon_full_access" on public.conversations;
