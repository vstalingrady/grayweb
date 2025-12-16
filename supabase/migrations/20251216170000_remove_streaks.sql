-- Remove legacy streak tracking (streak tables/columns).

alter table if exists public.habits drop column if exists streak_label;
alter table if exists public.habits drop column if exists streak_id;

drop table if exists public.user_streaks cascade;

