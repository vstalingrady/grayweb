-- Tie general chat rows directly to user_data and enforce cascading deletes.

do $$
begin
    if exists (
        select 1
        from information_schema.tables
        where table_schema = 'public'
          and table_name = 'general_chat_messages'
    ) then
        -- Ensure every referenced user has a user_data record.
        insert into public.user_data (user_identifier)
        select distinct g.user_id
        from public.general_chat_messages g
        where g.user_id is not null
          and not exists (
            select 1
            from public.user_data ud
            where ud.user_identifier = g.user_id
          );

        -- Add the user_data_id column if missing.
        alter table public.general_chat_messages
            add column if not exists user_data_id bigint;

        -- Backfill the new column.
        update public.general_chat_messages as g
        set user_data_id = ud.id
        from public.user_data as ud
        where ud.user_identifier = g.user_id
          and g.user_data_id is null;

        -- Enforce not-null semantics once the column is populated.
        if exists (
            select 1
            from public.general_chat_messages
            where user_data_id is null
        ) then
            raise notice 'Skipping SET NOT NULL on general_chat_messages.user_data_id due remaining NULL rows.';
        else
            alter table public.general_chat_messages
                alter column user_data_id set not null;
        end if;
    else
        raise notice 'Skipping general_chat_messages backfill; table does not exist.';
    end if;
end $$;

-- Create an index to keep lookups fast.
create index if not exists idx_general_chat_messages_user_data
    on public.general_chat_messages (user_data_id, created_at);

-- Add the foreign key with cascade semantics (noop if it already exists).
do $$
begin
    if not exists (
        select 1
        from information_schema.table_constraints
        where table_schema = 'public'
          and table_name = 'general_chat_messages'
          and constraint_name = 'general_chat_messages_user_data_id_fkey'
    ) then
        alter table public.general_chat_messages
            add constraint general_chat_messages_user_data_id_fkey
            foreign key (user_data_id)
            references public.user_data (id)
            on delete cascade;
    end if;
end $$;
