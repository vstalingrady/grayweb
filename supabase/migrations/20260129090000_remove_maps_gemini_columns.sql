alter table public.users drop column if exists maps_enabled;
alter table public.users drop column if exists daily_gemini_pro_usage;
alter table public.users drop column if exists last_daily_gemini_pro_reset;
