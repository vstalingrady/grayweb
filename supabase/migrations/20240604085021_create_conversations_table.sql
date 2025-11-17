-- Create the conversations table used by the backend to persist chat history.
-- Includes optional user/server attribution fields so workspace cleanup routines
-- can efficiently scope records.

create extension if not exists pgcrypto;

create table if not exists public.conversations (
    id uuid primary key default gen_random_uuid(),
    user_id bigint,
    server_id bigint,
    channel_id bigint,
    title text,
    history jsonb not null default '[]'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_conversations_created_at_desc
    on public.conversations (created_at desc);

create index if not exists idx_conversations_user_server
    on public.conversations (user_id, server_id);

