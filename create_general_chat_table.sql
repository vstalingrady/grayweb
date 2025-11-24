-- Create general_chat_messages table for /g (General) chat
-- This stores the conversation history for the general chat workspace

CREATE TABLE IF NOT EXISTS public.general_chat_messages (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    user_data_id BIGINT,
    role TEXT NOT NULL CHECK (role IN ('user', 'model')),
    content TEXT NOT NULL,
    attachments JSONB NULL,
    grounding_metadata JSONB NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_general_chat_messages_user_created
    ON public.general_chat_messages (user_id, created_at);

CREATE INDEX IF NOT EXISTS idx_general_chat_messages_user_data
    ON public.general_chat_messages (user_data_id, created_at);

-- Enable Row Level Security
ALTER TABLE public.general_chat_messages ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "general_chat_messages_service_role_full_access" ON public.general_chat_messages;

-- Create policy for service role (backend access)
CREATE POLICY "general_chat_messages_service_role_full_access"
    ON public.general_chat_messages
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Verify the table was created
SELECT 'general_chat_messages table created successfully!' AS status;
