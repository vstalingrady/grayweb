-- Add streak tracking on users table (simple per-user streak counter).

alter table if exists public.users
    add column if not exists streak_count integer not null default 0;

alter table if exists public.users
    add column if not exists streak_last_date text;
