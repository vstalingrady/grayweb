-- Allow anonymous access to conversations table for the backend application
-- This enables the backend to read/write conversation data using the anon key

create policy "conversations_anon_full_access"
    on public.conversations
    for all
    to anon
    using (true)
    with check (true);