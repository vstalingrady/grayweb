-- Mirror the local SQLite workflow tables (plans, habits, reminders) inside Supabase
-- so that all dashboard data lives in a single database.

create table if not exists public.plans (
    id bigserial primary key,
    user_id bigint not null,
    label text not null,
    completed boolean not null default false,
    deadline text null,
    schedule_slot text null,
    description text null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_plans_user_id_created_at
    on public.plans (user_id, created_at desc);

alter table if exists public.plans
    enable row level security;

revoke all on table public.plans from public;
revoke all on table public.plans from anon;
revoke all on table public.plans from authenticated;

do $$
begin
    if exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'plans'
          and policyname = 'plans_service_role_full_access'
    ) then
        execute 'drop policy "plans_service_role_full_access" on public.plans';
    end if;
end $$;

create policy "plans_service_role_full_access"
    on public.plans
    for all
    to service_role
    using (true)
    with check (true);


create table if not exists public.habits (
    id bigserial primary key,
    user_id bigint not null,
    label text not null,
    streak_label text not null,
    previous_label text not null,
    description text null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_habits_user_id_created_at
    on public.habits (user_id, created_at desc);

alter table if exists public.habits
    enable row level security;

revoke all on table public.habits from public;
revoke all on table public.habits from anon;
revoke all on table public.habits from authenticated;

do $$
begin
    if exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'habits'
          and policyname = 'habits_service_role_full_access'
    ) then
        execute 'drop policy "habits_service_role_full_access" on public.habits';
    end if;
end $$;

create policy "habits_service_role_full_access"
    on public.habits
    for all
    to service_role
    using (true)
    with check (true);


create table if not exists public.reminders (
    id bigserial primary key,
    user_id bigint not null,
    entity_type text null,
    entity_id bigint null,
    delivery_mode text null,
    label text not null,
    description text null,
    summary text null,
    remind_at timestamptz not null,
    status text not null default 'pending',
    metadata jsonb null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    delivered_at timestamptz null
);

create index if not exists idx_reminders_user_id_status
    on public.reminders (user_id, status);

create index if not exists idx_reminders_user_id_remind_at
    on public.reminders (user_id, remind_at);

alter table if exists public.reminders
    enable row level security;

revoke all on table public.reminders from public;
revoke all on table public.reminders from anon;
revoke all on table public.reminders from authenticated;

do $$
begin
    if exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'reminders'
          and policyname = 'reminders_service_role_full_access'
    ) then
        execute 'drop policy "reminders_service_role_full_access" on public.reminders';
    end if;
end $$;

create policy "reminders_service_role_full_access"
    on public.reminders
    for all
    to service_role
    using (true)
    with check (true);
