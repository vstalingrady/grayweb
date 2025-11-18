-- Add scope column to chat_sessions table
-- This allows the frontend to filter sessions by scope (e.g., 'thread', 'general')

do $$
begin
    if not exists (
        select 1 from information_schema.columns
        where table_schema = 'public'
          and table_name = 'chat_sessions'
          and column_name = 'scope'
    ) then
        alter table public.chat_sessions
            add column scope text not null default 'thread';
    end if;
end $$;
