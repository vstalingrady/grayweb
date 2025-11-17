-- Persist per-user proactivity schedules so settings remain visible in Supabase Studio.
-- The backend still maintains a SQLite copy for local development, but Supabase is now
-- the source of truth whenever a project is configured with a service-role key.

create table if not exists public.proactivity_settings (
    id bigserial primary key,
    user_id bigint not null,
    payload jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create unique index if not exists idx_proactivity_settings_user_id
    on public.proactivity_settings (user_id);

alter table if exists public.proactivity_settings
    enable row level security;

revoke all on table public.proactivity_settings from public;
revoke all on table public.proactivity_settings from anon;
revoke all on table public.proactivity_settings from authenticated;

do $$
begin
    if exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'proactivity_settings'
          and policyname = 'proactivity_settings_service_role_full_access'
    ) then
        execute 'drop policy "proactivity_settings_service_role_full_access" on public.proactivity_settings';
    end if;
end $$;

create policy "proactivity_settings_service_role_full_access"
    on public.proactivity_settings
    for all
    to service_role
    using (true)
    with check (true);
