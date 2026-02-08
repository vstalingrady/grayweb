-- Align Supabase schema with backend runtime expectations.
-- Safe additive migration: only CREATE IF NOT EXISTS / ADD COLUMN IF NOT EXISTS / non-destructive updates.

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- users table parity
-- -----------------------------------------------------------------------------
alter table if exists public.users add column if not exists auth_user_id text;
alter table if exists public.users add column if not exists improve_model_for_everyone boolean default false;
alter table if exists public.users add column if not exists personalization_system_prompt_override text;
alter table if exists public.users add column if not exists personalization_location text;
alter table if exists public.users add column if not exists personalization_time_zone text;
alter table if exists public.users add column if not exists onboarding_completed boolean default false;
alter table if exists public.users add column if not exists preferred_model text;
alter table if exists public.users add column if not exists visible_model_ids jsonb;

do $$
begin
    if exists (
        select 1 from information_schema.tables
        where table_schema = 'public' and table_name = 'users'
    ) then
        create unique index if not exists idx_users_auth_user_id
            on public.users (auth_user_id)
            where auth_user_id is not null;

        update public.users
        set improve_model_for_everyone = false
        where improve_model_for_everyone is null;

        update public.users
        set onboarding_completed = false
        where onboarding_completed is null;
    end if;
end $$;

-- -----------------------------------------------------------------------------
-- plans / habits / calendar_events / archives parity
-- -----------------------------------------------------------------------------
alter table if exists public.plans
    add column if not exists color text;

alter table if exists public.habits
    add column if not exists completed boolean default false;
alter table if exists public.habits
    add column if not exists previous_label text;

do $$
begin
    if exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'habits'
          and column_name = 'previous_label'
          and is_nullable = 'NO'
    ) then
        alter table public.habits
            alter column previous_label drop not null;
    end if;
end $$;

do $$
begin
    if exists (
        select 1 from information_schema.tables
        where table_schema = 'public' and table_name = 'habits'
    ) then
        update public.habits
        set completed = false
        where completed is null;
    end if;
end $$;

alter table if exists public.calendar_events add column if not exists color text;
alter table if exists public.calendar_events add column if not exists reminder_minutes_before integer;
alter table if exists public.calendar_events add column if not exists entry_type text default 'event';
alter table if exists public.calendar_events add column if not exists is_completed boolean default false;
alter table if exists public.calendar_events add column if not exists recurrence text;
alter table if exists public.calendar_events add column if not exists habit_id bigint;
alter table if exists public.calendar_events add column if not exists reminder_at timestamptz;
alter table if exists public.calendar_events add column if not exists updated_at timestamptz default now();

do $$
begin
    if exists (
        select 1 from information_schema.tables
        where table_schema = 'public' and table_name = 'calendar_events'
    ) then
        update public.calendar_events
        set updated_at = coalesce(updated_at, created_at, now())
        where updated_at is null;
    end if;
end $$;

alter table if exists public.archived_chat_messages
    add column if not exists reminders jsonb;

-- -----------------------------------------------------------------------------
-- Missing runtime tables
-- -----------------------------------------------------------------------------
create table if not exists public.transactions (
    id bigserial primary key,
    user_id bigint not null,
    order_id text not null unique,
    amount integer not null,
    currency text null,
    status text not null default 'pending',
    payment_type text null,
    plan_tier text not null,
    billing_cycle text null,
    subscription_starts_at timestamptz null,
    subscription_ends_at timestamptz null,
    paid_at timestamptz null,
    snap_token text null,
    snap_redirect_url text null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_transactions_user_id
    on public.transactions (user_id);

create table if not exists public.payment_webhook_events (
    id bigserial primary key,
    provider text not null,
    event_key text not null,
    order_id text null,
    event_type text null,
    created_at timestamptz not null default now(),
    constraint uq_payment_webhook_events_provider_key unique (provider, event_key)
);

create index if not exists idx_payment_webhook_events_order_id
    on public.payment_webhook_events (order_id);

create table if not exists public.proactivity_delivery_guard (
    id bigserial primary key,
    user_id bigint not null,
    delivery_key text not null,
    created_at timestamptz not null default now(),
    constraint uq_proactivity_delivery_guard_user_key unique (user_id, delivery_key)
);

create index if not exists idx_proactivity_delivery_guard_user_id
    on public.proactivity_delivery_guard (user_id);

create table if not exists public.proactivity_push_subscriptions (
    id bigserial primary key,
    user_id bigint not null,
    endpoint text not null unique,
    p256dh text not null,
    auth text not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_proactivity_push_subscriptions_user_id
    on public.proactivity_push_subscriptions (user_id);

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

create table if not exists public.google_calendar_states (
    id bigserial primary key,
    state_token text not null unique,
    user_id bigint null,
    nonce text not null,
    redirect_uri text not null,
    expires_at timestamptz null,
    consumed_at timestamptz null,
    created_at timestamptz not null default now()
);

create index if not exists idx_google_calendar_states_expires_at
    on public.google_calendar_states (expires_at);

create table if not exists public.hire_applications (
    id bigserial primary key,
    role text not null,
    full_name text not null,
    email text not null,
    location text null,
    university_background text null,
    major_field text null,
    linkedin_url text null,
    social_links text null,
    interest_reason text null,
    alignment_vision text null,
    studies_balance text null,
    resume_filename text null,
    resume_mime text null,
    resume_size integer null,
    resume_storage_path text null,
    github_url text null,
    hardest_build text null,
    tech_stack text null,
    built_links text null,
    growth_plan text null,
    growth_take text null,
    equity_reason text null,
    additional_notes text null,
    user_agent text null,
    ip_address text null,
    created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- RLS service-role policies for newly-added runtime tables
-- -----------------------------------------------------------------------------
alter table if exists public.transactions enable row level security;
alter table if exists public.payment_webhook_events enable row level security;
alter table if exists public.proactivity_delivery_guard enable row level security;
alter table if exists public.proactivity_push_subscriptions enable row level security;
alter table if exists public.google_calendar_credentials enable row level security;
alter table if exists public.google_calendar_states enable row level security;
alter table if exists public.hire_applications enable row level security;

revoke all on table public.transactions from public;
revoke all on table public.transactions from anon;
revoke all on table public.transactions from authenticated;
revoke all on table public.payment_webhook_events from public;
revoke all on table public.payment_webhook_events from anon;
revoke all on table public.payment_webhook_events from authenticated;
revoke all on table public.proactivity_delivery_guard from public;
revoke all on table public.proactivity_delivery_guard from anon;
revoke all on table public.proactivity_delivery_guard from authenticated;
revoke all on table public.proactivity_push_subscriptions from public;
revoke all on table public.proactivity_push_subscriptions from anon;
revoke all on table public.proactivity_push_subscriptions from authenticated;
revoke all on table public.google_calendar_credentials from public;
revoke all on table public.google_calendar_credentials from anon;
revoke all on table public.google_calendar_credentials from authenticated;
revoke all on table public.google_calendar_states from public;
revoke all on table public.google_calendar_states from anon;
revoke all on table public.google_calendar_states from authenticated;
revoke all on table public.hire_applications from public;
revoke all on table public.hire_applications from anon;
revoke all on table public.hire_applications from authenticated;

do $$
begin
    if not exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'transactions'
          and policyname = 'transactions_service_role_full_access'
    ) then
        create policy "transactions_service_role_full_access"
            on public.transactions
            for all
            to service_role
            using (true)
            with check (true);
    end if;
end $$;

do $$
begin
    if not exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'payment_webhook_events'
          and policyname = 'payment_webhook_events_service_role_full_access'
    ) then
        create policy "payment_webhook_events_service_role_full_access"
            on public.payment_webhook_events
            for all
            to service_role
            using (true)
            with check (true);
    end if;
end $$;

do $$
begin
    if not exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'proactivity_delivery_guard'
          and policyname = 'proactivity_delivery_guard_service_role_full_access'
    ) then
        create policy "proactivity_delivery_guard_service_role_full_access"
            on public.proactivity_delivery_guard
            for all
            to service_role
            using (true)
            with check (true);
    end if;
end $$;

do $$
begin
    if not exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'proactivity_push_subscriptions'
          and policyname = 'proactivity_push_subscriptions_service_role_full_access'
    ) then
        create policy "proactivity_push_subscriptions_service_role_full_access"
            on public.proactivity_push_subscriptions
            for all
            to service_role
            using (true)
            with check (true);
    end if;
end $$;

do $$
begin
    if not exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'google_calendar_credentials'
          and policyname = 'google_calendar_credentials_service_role_full_access'
    ) then
        create policy "google_calendar_credentials_service_role_full_access"
            on public.google_calendar_credentials
            for all
            to service_role
            using (true)
            with check (true);
    end if;
end $$;

do $$
begin
    if not exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'google_calendar_states'
          and policyname = 'google_calendar_states_service_role_full_access'
    ) then
        create policy "google_calendar_states_service_role_full_access"
            on public.google_calendar_states
            for all
            to service_role
            using (true)
            with check (true);
    end if;
end $$;

do $$
begin
    if not exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'hire_applications'
          and policyname = 'hire_applications_service_role_full_access'
    ) then
        create policy "hire_applications_service_role_full_access"
            on public.hire_applications
            for all
            to service_role
            using (true)
            with check (true);
    end if;
end $$;
