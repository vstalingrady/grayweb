-- Drop Rolling Memory System
-- This migration removes all rolling memory related database objects

-- Drop the view first (depends on tables)
DROP VIEW IF EXISTS public.rolling_memory_overview;

-- Drop the function
DROP FUNCTION IF EXISTS public.get_rolling_memory_stats(BIGINT);

-- Drop the user_memory_summaries table (stores compressed memory)
DROP TABLE IF EXISTS public.user_memory_summaries;
