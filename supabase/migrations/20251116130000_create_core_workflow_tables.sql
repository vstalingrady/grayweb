-- Mirror the SQLite schema defined inside backend/main.py so Supabase
-- has the same first-class tables that FastAPI expects.

create table if not exists public.users (
    id bigserial primary key,
    email text not null unique,
    full_name text not null,
    profile_picture_url text null,
    role text not null default 'user',
    initials text null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_users_email on public.users (email);

alter table if exists public.users enable row level security;

revoke all on table public.users from public;
revoke all on table public.users from anon;
revoke all on table public.users from authenticated;

do $$
begin
    if exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'users'
          and policyname = 'users_service_role_full_access'
    ) then
        execute 'drop policy "users_service_role_full_access" on public.users';
    end if;
end $$;

create policy "users_service_role_full_access"
    on public.users
    for all
    to service_role
    using (true)
    with check (true);


create table if not exists public.chat_sessions (
    id bigserial primary key,
    user_id bigint not null,
    title text not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_chat_sessions_user_id
    on public.chat_sessions (user_id, created_at desc);

alter table if exists public.chat_sessions enable row level security;

revoke all on table public.chat_sessions from public;
revoke all on table public.chat_sessions from anon;
revoke all on table public.chat_sessions from authenticated;

do $$
begin
    if exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'chat_sessions'
          and policyname = 'chat_sessions_service_role_full_access'
    ) then
        execute 'drop policy "chat_sessions_service_role_full_access" on public.chat_sessions';
    end if;
end $$;

create policy "chat_sessions_service_role_full_access"
    on public.chat_sessions
    for all
    to service_role
    using (true)
    with check (true);


create table if not exists public.calendars (
    id bigserial primary key,
    user_id bigint not null,
    label text not null,
    color text not null,
    is_visible boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_calendars_user_id
    on public.calendars (user_id, created_at desc);

alter table if exists public.calendars enable row level security;

revoke all on table public.calendars from public;
revoke all on table public.calendars from anon;
revoke all on table public.calendars from authenticated;

do $$
begin
    if exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'calendars'
          and policyname = 'calendars_service_role_full_access'
    ) then
        execute 'drop policy "calendars_service_role_full_access" on public.calendars';
    end if;
end $$;

create policy "calendars_service_role_full_access"
    on public.calendars
    for all
    to service_role
    using (true)
    with check (true);


create table if not exists public.calendar_events (
    id bigserial primary key,
    user_id bigint not null,
    calendar_id bigint null,
    title text not null,
    description text null,
    start_time timestamptz not null,
    end_time timestamptz not null,
    created_at timestamptz not null default now()
);

create index if not exists idx_calendar_events_user_start
    on public.calendar_events (user_id, start_time desc);

alter table if exists public.calendar_events enable row level security;

revoke all on table public.calendar_events from public;
revoke all on table public.calendar_events from anon;
revoke all on table public.calendar_events from authenticated;

do $$
begin
    if exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'calendar_events'
          and policyname = 'calendar_events_service_role_full_access'
    ) then
        execute 'drop policy "calendar_events_service_role_full_access" on public.calendar_events';
    end if;
end $$;

create policy "calendar_events_service_role_full_access"
    on public.calendar_events
    for all
    to service_role
    using (true)
    with check (true);


create table if not exists public.dashboard_pulses (
    id bigserial primary key,
    user_id bigint not null,
    date_key text not null,
    timestamp timestamptz not null,
    plans jsonb not null default '[]'::jsonb,
    habits jsonb not null default '[]'::jsonb,
    proactivity jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint uq_dashboard_pulses_user_date unique (user_id, date_key)
);

create index if not exists idx_dashboard_pulses_user_date
    on public.dashboard_pulses (user_id, date_key desc);

alter table if exists public.dashboard_pulses enable row level security;

revoke all on table public.dashboard_pulses from public;
revoke all on table public.dashboard_pulses from anon;
revoke all on table public.dashboard_pulses from authenticated;

do $$
begin
    if exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'dashboard_pulses'
          and policyname = 'dashboard_pulses_service_role_full_access'
    ) then
        execute 'drop policy "dashboard_pulses_service_role_full_access" on public.dashboard_pulses';
    end if;
end $$;

create policy "dashboard_pulses_service_role_full_access"
    on public.dashboard_pulses
    for all
    to service_role
    using (true)
    with check (true);


create table if not exists public.user_streaks (
    id bigserial primary key,
    user_id bigint not null unique,
    current_streak integer not null default 0,
    last_activity_date timestamptz null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table if exists public.user_streaks enable row level security;

revoke all on table public.user_streaks from public;
revoke all on table public.user_streaks from anon;
revoke all on table public.user_streaks from authenticated;

do $$
begin
    if exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'user_streaks'
          and policyname = 'user_streaks_service_role_full_access'
    ) then
        execute 'drop policy "user_streaks_service_role_full_access" on public.user_streaks';
    end if;
end $$;

create policy "user_streaks_service_role_full_access"
    on public.user_streaks
    for all
    to service_role
    using (true)
    with check (true);


create table if not exists public.proactivity_logs (
    id bigserial primary key,
    user_id bigint not null,
    activity_date timestamptz not null default now(),
    tasks_completed integer not null default 0,
    total_tasks integer not null default 0,
    score integer not null default 0,
    notes text null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_proactivity_logs_user_activity
    on public.proactivity_logs (user_id, activity_date desc);

alter table if exists public.proactivity_logs enable row level security;

revoke all on table public.proactivity_logs from public;
revoke all on table public.proactivity_logs from anon;
revoke all on table public.proactivity_logs from authenticated;

do $$
begin
    if exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'proactivity_logs'
          and policyname = 'proactivity_logs_service_role_full_access'
    ) then
        execute 'drop policy "proactivity_logs_service_role_full_access" on public.proactivity_logs';
    end if;
end $$;

create policy "proactivity_logs_service_role_full_access"
    on public.proactivity_logs
    for all
    to service_role
    using (true)
    with check (true);


create table if not exists public.file_search_stores (
    id bigserial primary key,
    user_id bigint not null unique,
    store_name text not null unique,
    display_name text null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table if exists public.file_search_stores enable row level security;

revoke all on table public.file_search_stores from public;
revoke all on table public.file_search_stores from anon;
revoke all on table public.file_search_stores from authenticated;

do $$
begin
    if exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'file_search_stores'
          and policyname = 'file_search_stores_service_role_full_access'
    ) then
        execute 'drop policy "file_search_stores_service_role_full_access" on public.file_search_stores';
    end if;
end $$;

create policy "file_search_stores_service_role_full_access"
    on public.file_search_stores
    for all
    to service_role
    using (true)
    with check (true);


create table if not exists public.media_uploads (
    id bigserial primary key,
    user_id bigint not null,
    filename text not null,
    mime_type text not null,
    size bigint not null,
    storage_path text not null,
    created_at timestamptz not null default now()
);

create index if not exists idx_media_uploads_user_created
    on public.media_uploads (user_id, created_at desc);

alter table if exists public.media_uploads enable row level security;

revoke all on table public.media_uploads from public;
revoke all on table public.media_uploads from anon;
revoke all on table public.media_uploads from authenticated;

do $$
begin
    if exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'media_uploads'
          and policyname = 'media_uploads_service_role_full_access'
    ) then
        execute 'drop policy "media_uploads_service_role_full_access" on public.media_uploads';
    end if;
end $$;

create policy "media_uploads_service_role_full_access"
    on public.media_uploads
    for all
    to service_role
    using (true)
    with check (true);


create table if not exists public.context_cache (
    id bigserial primary key,
    user_id bigint not null,
    conversation_id text null,
    label text null,
    content text not null,
    created_at timestamptz not null default now()
);

create index if not exists idx_context_cache_user_created
    on public.context_cache (user_id, created_at desc);

alter table if exists public.context_cache enable row level security;

revoke all on table public.context_cache from public;
revoke all on table public.context_cache from anon;
revoke all on table public.context_cache from authenticated;

do $$
begin
    if exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'context_cache'
          and policyname = 'context_cache_service_role_full_access'
    ) then
        execute 'drop policy "context_cache_service_role_full_access" on public.context_cache';
    end if;
end $$;

create policy "context_cache_service_role_full_access"
    on public.context_cache
    for all
    to service_role
    using (true)
    with check (true);


create table if not exists public.proactive_notifications (
    id bigserial primary key,
    user_id bigint not null,
    type text not null,
    title text not null,
    message text not null,
    metadata jsonb null,
    due_at timestamptz null,
    sent_at timestamptz not null default now(),
    read_at timestamptz null,
    completed_at timestamptz null,
    created_at timestamptz not null default now()
);

create index if not exists idx_proactive_notifications_user_sent
    on public.proactive_notifications (user_id, sent_at desc);

alter table if exists public.proactive_notifications enable row level security;

revoke all on table public.proactive_notifications from public;
revoke all on table public.proactive_notifications from anon;
revoke all on table public.proactive_notifications from authenticated;

do $$
begin
    if exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'proactive_notifications'
          and policyname = 'proactive_notifications_service_role_full_access'
    ) then
        execute 'drop policy "proactive_notifications_service_role_full_access" on public.proactive_notifications';
    end if;
end $$;

create policy "proactive_notifications_service_role_full_access"
    on public.proactive_notifications
    for all
    to service_role
    using (true)
    with check (true);


create table if not exists public.google_calendar_credentials (
    id bigserial primary key,
    user_id bigint not null unique,
    access_token text not null,
    refresh_token text not null,
    token_uri text not null,
    client_id text not null,
    client_secret text not null,
    scopes text not null,
    expires_at timestamptz null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table if exists public.google_calendar_credentials enable row level security;

revoke all on table public.google_calendar_credentials from public;
revoke all on table public.google_calendar_credentials from anon;
revoke all on table public.google_calendar_credentials from authenticated;

do $$
begin
    if exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'google_calendar_credentials'
          and policyname = 'google_calendar_credentials_service_role_full_access'
    ) then
        execute 'drop policy "google_calendar_credentials_service_role_full_access" on public.google_calendar_credentials';
    end if;
end $$;

create policy "google_calendar_credentials_service_role_full_access"
    on public.google_calendar_credentials
    for all
    to service_role
    using (true)
    with check (true);
