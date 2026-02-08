ALTER TABLE IF EXISTS public.users
    ADD COLUMN IF NOT EXISTS personalization_show_calendar BOOLEAN DEFAULT TRUE;
