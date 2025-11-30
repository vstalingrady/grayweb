-- Rolling Memory System - Database Migration
-- ============================================
-- This migration adds support for the Rolling Memory / Recursive Token Compression system
-- Run this in your Supabase SQL editor

-- Step 1: Add long_term_memory column to user_data table
-- This stores the compressed conversation summary for each user
ALTER TABLE IF EXISTS public.user_data
    ADD COLUMN IF NOT EXISTS long_term_memory TEXT NULL;

COMMENT ON COLUMN public.user_data.long_term_memory IS 
    'Compressed summary of user conversation history for rolling memory system';

-- Step 2: Create index for faster lookups
-- This helps when loading memory for chat context preparation
CREATE INDEX IF NOT EXISTS idx_user_data_memory 
    ON public.user_data (user_identifier)
    WHERE long_term_memory IS NOT NULL;

-- Step 3: Optional - Create archived_chat_messages table
-- Use this if you want to keep old messages for analytics/compliance
-- instead of deleting them after compression
CREATE TABLE IF NOT EXISTS public.archived_chat_messages (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    user_data_id BIGINT REFERENCES public.user_data(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'model')),
    content TEXT NOT NULL,
    grounding_metadata JSONB NULL,
    attachments JSONB NULL,
    original_created_at TIMESTAMPTZ,
    archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    compression_batch_id UUID DEFAULT gen_random_uuid()
);

COMMENT ON TABLE public.archived_chat_messages IS 
    'Archive of compressed chat messages for data retention and analytics';

COMMENT ON COLUMN public.archived_chat_messages.compression_batch_id IS 
    'Groups messages that were compressed together in a single batch';

-- Step 4: Create indexes for archived messages
CREATE INDEX IF NOT EXISTS idx_archived_messages_user
    ON public.archived_chat_messages (user_id, archived_at DESC);

CREATE INDEX IF NOT EXISTS idx_archived_messages_batch
    ON public.archived_chat_messages (compression_batch_id);

CREATE INDEX IF NOT EXISTS idx_archived_messages_user_data
    ON public.archived_chat_messages (user_data_id, archived_at DESC);

-- Step 5: Enable Row Level Security on archived messages
ALTER TABLE IF EXISTS public.archived_chat_messages
    ENABLE ROW LEVEL SECURITY;

-- Step 6: Create RLS policy for service role
-- This allows your backend to read/write archived messages
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'archived_chat_messages'
          AND policyname = 'archived_messages_service_role_full_access'
    ) THEN
        CREATE POLICY "archived_messages_service_role_full_access"
            ON public.archived_chat_messages
            FOR ALL
            TO service_role
            USING (true)
            WITH CHECK (true);
    END IF;
END $$;

-- Step 7: Create helper function to get memory statistics
CREATE OR REPLACE FUNCTION public.get_rolling_memory_stats(p_user_id BIGINT)
RETURNS TABLE (
    user_id BIGINT,
    active_message_count BIGINT,
    archived_message_count BIGINT,
    memory_length INTEGER,
    memory_preview TEXT,
    last_compressed_at TIMESTAMPTZ,
    will_compress_soon BOOLEAN
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_active_count BIGINT;
    v_archived_count BIGINT;
    v_memory TEXT;
    v_memory_len INTEGER;
    v_last_archived TIMESTAMPTZ;
BEGIN
    -- Get active message count
    SELECT COUNT(*) INTO v_active_count
    FROM public.general_chat_messages
    WHERE general_chat_messages.user_id = p_user_id;
    
    -- Get archived message count
    SELECT COUNT(*) INTO v_archived_count
    FROM public.archived_chat_messages
    WHERE archived_chat_messages.user_id = p_user_id;
    
    -- Get long-term memory
    SELECT long_term_memory INTO v_memory
    FROM public.user_data
    WHERE user_data.user_identifier = p_user_id;
    
    v_memory_len := COALESCE(LENGTH(v_memory), 0);
    
    -- Get last compression time
    SELECT MAX(archived_at) INTO v_last_archived
    FROM public.archived_chat_messages
    WHERE archived_chat_messages.user_id = p_user_id;
    
    -- Return stats
    RETURN QUERY SELECT
        p_user_id,
        v_active_count,
        COALESCE(v_archived_count, 0::BIGINT),
        v_memory_len,
        CASE 
            WHEN v_memory_len > 200 THEN LEFT(v_memory, 200) || '...'
            ELSE v_memory
        END,
        v_last_archived,
        v_active_count > 10;  -- Will compress soon if more than threshold
END;
$$;

COMMENT ON FUNCTION public.get_rolling_memory_stats IS 
    'Get comprehensive statistics about rolling memory for a user';

-- Step 8: Create function to clean up old archived messages (optional)
-- Use this if you want to auto-delete archived messages after a certain period
CREATE OR REPLACE FUNCTION public.cleanup_old_archived_messages(
    p_days_to_keep INTEGER DEFAULT 90
)
RETURNS TABLE (
    deleted_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_deleted_count BIGINT;
BEGIN
    DELETE FROM public.archived_chat_messages
    WHERE archived_at < NOW() - (p_days_to_keep || ' days')::INTERVAL;
    
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    
    RETURN QUERY SELECT v_deleted_count;
END;
$$;

COMMENT ON FUNCTION public.cleanup_old_archived_messages IS 
    'Cleanup archived messages older than specified days (default 90)';

-- Step 9: Create a view for easy memory monitoring
-- Keep security_invoker=true so RLS and caller perms apply (avoid SECURITY DEFINER).
CREATE OR REPLACE VIEW public.rolling_memory_overview AS
SELECT 
    ud.user_identifier AS user_id,
    ud.id AS user_data_id,
    LENGTH(ud.long_term_memory) AS memory_size,
    LEFT(ud.long_term_memory, 100) AS memory_preview,
    COUNT(gcm.id) AS active_messages,
    (SELECT COUNT(*) FROM public.archived_chat_messages acm 
     WHERE acm.user_id = ud.user_identifier) AS archived_messages,
    (SELECT MAX(archived_at) FROM public.archived_chat_messages acm 
     WHERE acm.user_id = ud.user_identifier) AS last_compression_at,
    COUNT(gcm.id) > 10 AS should_compress,
    ud.updated_at AS memory_updated_at
FROM public.user_data ud
LEFT JOIN public.general_chat_messages gcm ON gcm.user_id = ud.user_identifier
GROUP BY ud.id, ud.user_identifier, ud.long_term_memory, ud.updated_at;

COMMENT ON VIEW public.rolling_memory_overview IS 
    'Overview of rolling memory status for all users';

-- Step 10: Grant necessary permissions
GRANT SELECT ON public.rolling_memory_overview TO service_role;
GRANT EXECUTE ON FUNCTION public.get_rolling_memory_stats TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_old_archived_messages TO service_role;

-- ============================================
-- Migration Complete! 🎉
-- ============================================

-- Verify the migration:
-- SELECT * FROM public.rolling_memory_overview LIMIT 10;
-- SELECT * FROM public.get_rolling_memory_stats(YOUR_USER_ID);

-- Optional: Schedule cleanup of old archived messages (run monthly)
-- SELECT * FROM public.cleanup_old_archived_messages(90);
