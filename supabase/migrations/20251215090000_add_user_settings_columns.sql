-- Persist per-user UI/settings preferences (survive browser resets / multi-device)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS theme_mode TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS ui_locale TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS preferred_response_language TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS notification_preferences JSONB;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS conversation_memory_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS auto_web_search_enabled BOOLEAN DEFAULT FALSE;

