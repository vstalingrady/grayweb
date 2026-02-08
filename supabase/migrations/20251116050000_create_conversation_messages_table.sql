-- Normalize conversation storage by moving individual messages into their
-- own table. The existing public.conversations table remains the source of
-- truth for high-level metadata (id, user_id, title, created_at, updated_at)
-- while public.conversation_messages stores one row per message.

create table if not exists public.conversation_messages (
    id bigserial primary key,
    conversation_id uuid not null references public.conversations (id) on delete cascade,
    user_id bigint,
    role text not null check (role in ('user', 'model')),
    text text not null,
    grounding_metadata jsonb,
    created_at timestamptz not null default now()
);

create index if not exists idx_conversation_messages_conversation_created_at
    on public.conversation_messages (conversation_id, created_at, id);

create index if not exists idx_conversation_messages_user_id
    on public.conversation_messages (user_id);

-- Enable row level security and keep backend access scoped to service_role.

alter table if exists public.conversation_messages
    enable row level security;

revoke all on table public.conversation_messages from public;
revoke all on table public.conversation_messages from anon;
revoke all on table public.conversation_messages from authenticated;

do $$
begin
    if exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'conversation_messages'
          and policyname = 'conversation_messages_service_role_full_access'
    ) then
        execute 'drop policy "conversation_messages_service_role_full_access" on public.conversation_messages';
    end if;

    if exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'conversation_messages'
          and policyname = 'conversation_messages_anon_full_access'
    ) then
        execute 'drop policy "conversation_messages_anon_full_access" on public.conversation_messages';
    end if;
end $$;

create policy "conversation_messages_service_role_full_access"
    on public.conversation_messages
    for all
    to service_role
    using (true)
    with check (true);


-- One-time migration: backfill messages from the legacy conversations.history
-- jsonb array into the new conversation_messages table. This only inserts
-- messages for conversations that do not already have messages, so it is
-- safe to run more than once.

insert into public.conversation_messages (
    conversation_id,
    user_id,
    role,
    text,
    grounding_metadata,
    created_at
)
select
    c.id as conversation_id,
    c.user_id,
    case
        when msg ->> 'role' = 'assistant' then 'model'
        else msg ->> 'role'
    end as role,
    coalesce(msg ->> 'text', '') as text,
    msg -> 'grounding_metadata' as grounding_metadata,
    coalesce(
        nullif(msg ->> 'created_at', '')::timestamptz,
        c.created_at,
        'epoch'::timestamptz
    ) as created_at
from public.conversations c
cross join lateral jsonb_array_elements(c.history) as msg
where c.history is not null
  and jsonb_typeof(c.history) = 'array'
  and (msg ->> 'role') is not null
  and case
          when msg ->> 'role' = 'assistant' then 'model'
          else msg ->> 'role'
      end in ('user', 'model')
  and not exists (
      select 1
      from public.conversation_messages existing
      where existing.conversation_id = c.id
        and existing.role = case
            when msg ->> 'role' = 'assistant' then 'model'
            else msg ->> 'role'
        end
        and existing.text = coalesce(msg ->> 'text', '')
        and coalesce(existing.created_at, 'epoch'::timestamptz) = coalesce(
            nullif(msg ->> 'created_at', '')::timestamptz,
            c.created_at,
            'epoch'::timestamptz
        )
        and existing.grounding_metadata is not distinct from msg -> 'grounding_metadata'
  );
