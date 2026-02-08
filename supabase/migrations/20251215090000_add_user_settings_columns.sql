-- Persist per-user UI/settings preferences (survive browser resets / multi-device)
ALTER TABLE IF EXISTS public.users ADD COLUMN IF NOT EXISTS theme_mode TEXT;
ALTER TABLE IF EXISTS public.users ADD COLUMN IF NOT EXISTS ui_locale TEXT;
ALTER TABLE IF EXISTS public.users ADD COLUMN IF NOT EXISTS preferred_response_language TEXT;
ALTER TABLE IF EXISTS public.users ADD COLUMN IF NOT EXISTS notification_preferences JSONB;
ALTER TABLE IF EXISTS public.users ADD COLUMN IF NOT EXISTS conversation_memory_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE IF EXISTS public.users ADD COLUMN IF NOT EXISTS auto_web_search_enabled BOOLEAN DEFAULT FALSE;
