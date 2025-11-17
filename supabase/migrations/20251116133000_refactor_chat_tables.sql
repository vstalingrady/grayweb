-- Rename the legacy `conversations` tables to `chat_threads`/* messages so the
-- schema reflects the thread/message hierarchy, and add a dedicated store for
-- the General workspace (/g) that should not share the thread tables.

do $$
begin
    if exists (
        select 1 from information_schema.tables
        where table_schema = 'public'
          and table_name = 'conversations'
    ) then
        execute 'alter table public.conversations rename to chat_threads';
    end if;
end $$;

do $$
begin
    if exists (
        select 1 from pg_class
        where relkind = 'S'
          and relname = 'conversations_id_seq'
    ) then
        execute 'alter sequence public.conversations_id_seq rename to chat_threads_id_seq';
    end if;
end $$;

do $$
begin
    if exists (
        select 1 from pg_indexes
        where schemaname = 'public'
          and indexname = 'idx_conversations_created_at_desc'
    ) then
        execute 'alter index public.idx_conversations_created_at_desc rename to idx_chat_threads_created_at_desc';
    end if;
end $$;

do $$
begin
    if exists (
        select 1 from pg_indexes
        where schemaname = 'public'
          and indexname = 'idx_conversations_user_server'
    ) then
        execute 'alter index public.idx_conversations_user_server rename to idx_chat_threads_user_server';
    end if;
end $$;

do $$
begin
    if exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'chat_threads'
          and policyname = 'conversations_service_role_full_access'
    ) then
        execute 'alter policy "conversations_service_role_full_access" on public.chat_threads rename to "chat_threads_service_role_full_access"';
    end if;
end $$;

do $$
begin
    if exists (
        select 1 from information_schema.tables
        where table_schema = 'public'
          and table_name = 'conversation_messages'
    ) then
        execute 'alter table public.conversation_messages rename to chat_thread_messages';
    end if;
end $$;

do $$
begin
    if exists (
        select 1 from pg_class
        where relkind = 'S'
          and relname = 'conversation_messages_id_seq'
    ) then
        execute 'alter sequence public.conversation_messages_id_seq rename to chat_thread_messages_id_seq';
    end if;
end $$;

do $$
begin
    if exists (
        select 1 from pg_indexes
        where schemaname = 'public'
          and indexname = 'idx_conversation_messages_conversation_created_at'
    ) then
        execute 'alter index public.idx_conversation_messages_conversation_created_at rename to idx_chat_thread_messages_thread_created_at';
    end if;
end $$;

do $$
begin
    if exists (
        select 1 from pg_indexes
        where schemaname = 'public'
          and indexname = 'idx_conversation_messages_user_id'
    ) then
        execute 'alter index public.idx_conversation_messages_user_id rename to idx_chat_thread_messages_user_id';
    end if;
end $$;

do $$
begin
    if exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'chat_thread_messages'
          and policyname = 'conversation_messages_service_role_full_access'
    ) then
        execute 'alter policy "conversation_messages_service_role_full_access" on public.chat_thread_messages rename to "chat_thread_messages_service_role_full_access"';
    end if;
end $$;

do $$
begin
    if exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'chat_thread_messages'
          and policyname = 'conversation_messages_anon_full_access'
    ) then
        execute 'alter policy "conversation_messages_anon_full_access" on public.chat_thread_messages rename to "chat_thread_messages_anon_full_access"';
    end if;
end $$;


create table if not exists public.general_chat_messages (
    id bigserial primary key,
    user_id bigint not null,
    role text not null check (role in ('user', 'model')),
    content text not null,
    attachments jsonb null,
    grounding_metadata jsonb null,
    created_at timestamptz not null default now()
);

create index if not exists idx_general_chat_messages_user_created
    on public.general_chat_messages (user_id, created_at);

alter table if exists public.general_chat_messages
    enable row level security;

revoke all on table public.general_chat_messages from public;
revoke all on table public.general_chat_messages from anon;
revoke all on table public.general_chat_messages from authenticated;

do $$
begin
    if exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'general_chat_messages'
          and policyname = 'general_chat_messages_service_role_full_access'
    ) then
        execute 'drop policy "general_chat_messages_service_role_full_access" on public.general_chat_messages';
    end if;
end $$;

create policy "general_chat_messages_service_role_full_access"
    on public.general_chat_messages
    for all
    to service_role
    using (true)
    with check (true);
