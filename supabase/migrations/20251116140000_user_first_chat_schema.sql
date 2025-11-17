-- Rebuild the chat schema to center data around individual users instead of
-- the legacy Discord-style server/channel hierarchy. Every user now has an
-- explicit record that owns its chat threads, and each thread stores its
-- messages in a dedicated table.

create table if not exists public.user_data (
    id bigserial primary key,
    user_identifier bigint not null unique,
    profile jsonb not null default '{}'::jsonb,
    context jsonb not null default '[]'::jsonb,
    metadata jsonb not null default '{}'::jsonb,
    workspace_context text null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_user_data_identifier
    on public.user_data (user_identifier);

alter table if exists public.user_data enable row level security;

revoke all on table public.user_data from public;
revoke all on table public.user_data from anon;
revoke all on table public.user_data from authenticated;

do $$
begin
    if exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'user_data'
          and policyname = 'user_data_service_role_full_access'
    ) then
        execute 'drop policy "user_data_service_role_full_access" on public.user_data';
    end if;

    if exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'user_data'
          and policyname = 'user_data_anon_full_access'
    ) then
        execute 'drop policy "user_data_anon_full_access" on public.user_data';
    end if;
end $$;

create policy "user_data_service_role_full_access"
    on public.user_data
    for all
    to service_role
    using (true)
    with check (true);

create policy "user_data_anon_full_access"
    on public.user_data
    for all
    to anon
    using (true)
    with check (true);


create table if not exists public.user_chat_threads (
    id uuid primary key default gen_random_uuid(),
    user_data_id bigint not null references public.user_data (id) on delete cascade,
    user_identifier bigint not null,
    title text not null default 'New Conversation',
    summary text null,
    context_snapshot jsonb not null default '[]'::jsonb,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    last_message_at timestamptz not null default now()
);

create index if not exists idx_user_chat_threads_user_identifier
    on public.user_chat_threads (user_identifier, updated_at desc);

create index if not exists idx_user_chat_threads_data
    on public.user_chat_threads (user_data_id, updated_at desc);

alter table if exists public.user_chat_threads enable row level security;

revoke all on table public.user_chat_threads from public;
revoke all on table public.user_chat_threads from anon;
revoke all on table public.user_chat_threads from authenticated;

do $$
begin
    if exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'user_chat_threads'
          and policyname = 'user_chat_threads_service_role_full_access'
    ) then
        execute 'drop policy "user_chat_threads_service_role_full_access" on public.user_chat_threads';
    end if;

    if exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'user_chat_threads'
          and policyname = 'user_chat_threads_anon_full_access'
    ) then
        execute 'drop policy "user_chat_threads_anon_full_access" on public.user_chat_threads';
    end if;
end $$;

create policy "user_chat_threads_service_role_full_access"
    on public.user_chat_threads
    for all
    to service_role
    using (true)
    with check (true);

create policy "user_chat_threads_anon_full_access"
    on public.user_chat_threads
    for all
    to anon
    using (true)
    with check (true);


create table if not exists public.user_chat_messages (
    id bigserial primary key,
    thread_id uuid not null references public.user_chat_threads (id) on delete cascade,
    role text not null check (role in ('user', 'model')),
    text text not null,
    grounding_metadata jsonb,
    attachments jsonb,
    created_at timestamptz not null default now()
);

create index if not exists idx_user_chat_messages_thread_created
    on public.user_chat_messages (thread_id, created_at, id);

alter table if exists public.user_chat_messages enable row level security;

revoke all on table public.user_chat_messages from public;
revoke all on table public.user_chat_messages from anon;
revoke all on table public.user_chat_messages from authenticated;

do $$
begin
    if exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'user_chat_messages'
          and policyname = 'user_chat_messages_service_role_full_access'
    ) then
        execute 'drop policy "user_chat_messages_service_role_full_access" on public.user_chat_messages';
    end if;

    if exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'user_chat_messages'
          and policyname = 'user_chat_messages_anon_full_access'
    ) then
        execute 'drop policy "user_chat_messages_anon_full_access" on public.user_chat_messages';
    end if;
end $$;

create policy "user_chat_messages_service_role_full_access"
    on public.user_chat_messages
    for all
    to service_role
    using (true)
    with check (true);

create policy "user_chat_messages_anon_full_access"
    on public.user_chat_messages
    for all
    to anon
    using (true)
    with check (true);


-- Backfill user-centric records from the legacy chat tables when they exist.

do $$
declare
    legacy_thread_count integer := 0;
begin
    select count(*) into legacy_thread_count
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'chat_threads';

    if legacy_thread_count > 0 then
        insert into public.user_data (user_identifier, profile, context, metadata, created_at, updated_at)
        select
            ct.user_id as user_identifier,
            '{}'::jsonb as profile,
            '[]'::jsonb as context,
            jsonb_build_object(
                'legacy_source',
                'chat_threads'
            ) as metadata,
            coalesce(min(ct.created_at), now()) as created_at,
            coalesce(max(ct.updated_at), now()) as updated_at
        from public.chat_threads ct
        where ct.user_id is not null
        group by ct.user_id
        on conflict (user_identifier) do update
            set updated_at = greatest(public.user_data.updated_at, excluded.updated_at);

        insert into public.user_chat_threads (
            id,
            user_data_id,
            user_identifier,
            title,
            summary,
            context_snapshot,
            metadata,
            created_at,
            updated_at,
            last_message_at
        )
        select
            ct.id,
            ud.id,
            ct.user_id,
            coalesce(nullif(ct.title, ''), 'Conversation'),
            null,
            '[]'::jsonb,
            jsonb_build_object(
                'legacy_history_count',
                case
                    when ct.history is not null and jsonb_typeof(ct.history) = 'array'
                        then jsonb_array_length(ct.history)
                    else 0
                end
            ),
            coalesce(ct.created_at, now()),
            coalesce(ct.updated_at, ct.created_at, now()),
            coalesce(ct.updated_at, ct.created_at, now())
        from public.chat_threads ct
        join public.user_data ud
          on ud.user_identifier = ct.user_id
        on conflict (id) do nothing;
    end if;
end $$;


do $$
declare
    legacy_messages_count integer := 0;
begin
    select count(*) into legacy_messages_count
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'chat_thread_messages';

    if legacy_messages_count > 0 then
        insert into public.user_chat_messages (
            thread_id,
            role,
            text,
            grounding_metadata,
            attachments,
            created_at
        )
        select
            cm.conversation_id as thread_id,
            cm.role,
            cm.text,
            cm.grounding_metadata,
            null,
            coalesce(cm.created_at, now())
        from public.chat_thread_messages cm;
    end if;
end $$;


-- Drop the Discord-focused tables now that the user-centric schema exists.
drop table if exists public.chat_thread_messages cascade;
drop table if exists public.chat_threads cascade;
