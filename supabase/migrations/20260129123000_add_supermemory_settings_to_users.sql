alter table public.users add column if not exists supermemory_auto_recall boolean;
alter table public.users add column if not exists supermemory_auto_capture boolean;
alter table public.users add column if not exists supermemory_capture_mode text;
alter table public.users add column if not exists supermemory_max_recall_results integer;
alter table public.users add column if not exists supermemory_profile_frequency integer;
