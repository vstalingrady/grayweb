-- Ensure the conversations table cannot be accessed without explicit policies.

alter table if exists public.conversations
    enable row level security;

-- Remove any broad grants so access is solely controlled via policies.
revoke all on table public.conversations from public;
revoke all on table public.conversations from anon;
revoke all on table public.conversations from authenticated;

do $$
begin
    if exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'conversations'
          and policyname = 'conversations_service_role_full_access'
    ) then
        execute 'drop policy "conversations_service_role_full_access" on public.conversations';
    end if;
end $$;

create policy "conversations_service_role_full_access"
    on public.conversations
    for all
    to service_role
    using (true)
    with check (true);
