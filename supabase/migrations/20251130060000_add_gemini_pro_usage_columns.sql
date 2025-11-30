-- Add Gemini 3 Pro usage tracking columns to users table
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS daily_gemini_pro_usage INTEGER DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_daily_gemini_pro_reset TIMESTAMPTZ;
