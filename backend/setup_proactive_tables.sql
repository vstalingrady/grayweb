-- Proactive Engagement System Database Setup
-- Run this script in your Supabase SQL Editor to create the necessary tables

-- ==================== CHECKIN PREFERENCES TABLE ====================
CREATE TABLE IF NOT EXISTS checkin_preferences (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    frequency TEXT NOT NULL CHECK (frequency IN ('high', 'medium', 'low')),
    local_time TIME NOT NULL,
    extra_local_times TIME[] DEFAULT '{}',
    days TEXT[] DEFAULT '{}',
    enabled BOOLEAN DEFAULT true,
    timezone TEXT DEFAULT 'UTC+00:00',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_checkin_preferences_user_id ON checkin_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_checkin_preferences_enabled ON checkin_preferences(enabled);

-- ==================== PROACTIVE STATE TABLE ====================
CREATE TABLE IF NOT EXISTS proactive_state (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE,
    last_daily_briefing JSONB,
    last_weekly_review TEXT,
    next_checkin_at TIMESTAMP WITH TIME ZONE,
    weekly_review_version INTEGER DEFAULT 3,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_proactive_state_user_id ON proactive_state(user_id);

-- ==================== USER GOALS TABLE ====================
CREATE TABLE IF NOT EXISTS user_goals (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    text TEXT NOT NULL,
    complete BOOLEAN DEFAULT false,
    due_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_goals_user_id ON user_goals(user_id);
CREATE INDEX IF NOT EXISTS idx_user_goals_complete ON user_goals(complete);
CREATE INDEX IF NOT EXISTS idx_user_goals_due_date ON user_goals(due_date);

-- ==================== USER HABITS TABLE ====================
CREATE TABLE IF NOT EXISTS user_habits (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    logs JSONB DEFAULT '[]',
    last_stuck_ping TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_habits_user_id ON user_habits(user_id);
CREATE INDEX IF NOT EXISTS idx_user_habits_name ON user_habits(name);

-- ==================== CHECKIN EVENTS TABLE ====================
CREATE TABLE IF NOT EXISTS checkin_events (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_checkin_events_user_id ON checkin_events(user_id);
CREATE INDEX IF NOT EXISTS idx_checkin_events_type ON checkin_events(type);
CREATE INDEX IF NOT EXISTS idx_checkin_events_sent_at ON checkin_events(sent_at DESC);

-- ==================== HELPER FUNCTIONS ====================

-- Function to create checkin_preferences table (called by app)
CREATE OR REPLACE FUNCTION create_checkin_preferences_table()
RETURNS void AS $$
BEGIN
    -- Table already created above, this is a no-op for the RPC call
    NULL;
END;
$$ LANGUAGE plpgsql;

-- Function to create proactive_state table (called by app)
CREATE OR REPLACE FUNCTION create_proactive_state_table()
RETURNS void AS $$
BEGIN
    -- Table already created above, this is a no-op for the RPC call
    NULL;
END;
$$ LANGUAGE plpgsql;

-- Function to create user_goals table (called by app)
CREATE OR REPLACE FUNCTION create_user_goals_table()
RETURNS void AS $$
BEGIN
    -- Table already created above, this is a no-op for the RPC call
    NULL;
END;
$$ LANGUAGE plpgsql;

-- Function to create user_habits table (called by app)
CREATE OR REPLACE FUNCTION create_user_habits_table()
RETURNS void AS $$
BEGIN
    -- Table already created above, this is a no-op for the RPC call
    NULL;
END;
$$ LANGUAGE plpgsql;

-- Function to create checkin_events table (called by app)
CREATE OR REPLACE FUNCTION create_checkin_events_table()
RETURNS void AS $$
BEGIN
    -- Table already created above, this is a no-op for the RPC call
    NULL;
END;
$$ LANGUAGE plpgsql;

-- ==================== ROW LEVEL SECURITY (RLS) ====================

-- Enable RLS on all tables
ALTER TABLE checkin_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE proactive_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_habits ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkin_events ENABLE ROW LEVEL SECURITY;

-- Create policies for checkin_preferences
CREATE POLICY "Users can view their own checkin preferences"
    ON checkin_preferences FOR SELECT
    USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert their own checkin preferences"
    ON checkin_preferences FOR INSERT
    WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update their own checkin preferences"
    ON checkin_preferences FOR UPDATE
    USING (auth.uid()::text = user_id);

-- Create policies for proactive_state
CREATE POLICY "Users can view their own proactive state"
    ON proactive_state FOR SELECT
    USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert their own proactive state"
    ON proactive_state FOR INSERT
    WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update their own proactive state"
    ON proactive_state FOR UPDATE
    USING (auth.uid()::text = user_id);

-- Create policies for user_goals
CREATE POLICY "Users can view their own goals"
    ON user_goals FOR SELECT
    USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert their own goals"
    ON user_goals FOR INSERT
    WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update their own goals"
    ON user_goals FOR UPDATE
    USING (auth.uid()::text = user_id);

CREATE POLICY "Users can delete their own goals"
    ON user_goals FOR DELETE
    USING (auth.uid()::text = user_id);

-- Create policies for user_habits
CREATE POLICY "Users can view their own habits"
    ON user_habits FOR SELECT
    USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert their own habits"
    ON user_habits FOR INSERT
    WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update their own habits"
    ON user_habits FOR UPDATE
    USING (auth.uid()::text = user_id);

CREATE POLICY "Users can delete their own habits"
    ON user_habits FOR DELETE
    USING (auth.uid()::text = user_id);

-- Create policies for checkin_events
CREATE POLICY "Users can view their own checkin events"
    ON checkin_events FOR SELECT
    USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert their own checkin events"
    ON checkin_events FOR INSERT
    WITH CHECK (auth.uid()::text = user_id);

-- ==================== TRIGGERS FOR UPDATED_AT ====================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at
CREATE TRIGGER update_checkin_preferences_updated_at
    BEFORE UPDATE ON checkin_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_proactive_state_updated_at
    BEFORE UPDATE ON proactive_state
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_goals_updated_at
    BEFORE UPDATE ON user_goals
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_habits_updated_at
    BEFORE UPDATE ON user_habits
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ==================== SAMPLE DATA (OPTIONAL) ====================

-- You can uncomment and run this section to add sample data for testing

/*
-- Sample user check-in preferences
INSERT INTO checkin_preferences (user_id, frequency, local_time, extra_local_times, days, enabled, timezone)
VALUES
    ('demo-user-1', 'medium', '08:00', '{}', '{}', true, 'UTC+00:00'),
    ('demo-user-2', 'high', '08:00', ARRAY['13:00'::TIME, '21:00'::TIME], '{}', true, 'UTC-05:00'),
    ('demo-user-3', 'low', '09:00', '{}', ARRAY['Monday', 'Wednesday', 'Friday'], true, 'UTC+05:30')
ON CONFLICT (user_id) DO NOTHING;
*/

-- ==================== VERIFICATION ====================

-- Run this to verify all tables were created
SELECT
    schemaname,
    tablename,
    tableowner
FROM pg_tables
WHERE tablename IN (
    'checkin_preferences',
    'proactive_state',
    'user_goals',
    'user_habits',
    'checkin_events'
)
ORDER BY tablename;

-- Run this to verify all functions were created
SELECT
    routine_name,
    routine_type
FROM information_schema.routines
WHERE routine_name IN (
    'create_checkin_preferences_table',
    'create_proactive_state_table',
    'create_user_goals_table',
    'create_user_habits_table',
    'create_checkin_events_table',
    'update_updated_at_column'
)
ORDER BY routine_name;

-- Run this to verify RLS policies
SELECT
    tablename,
    policyname
FROM pg_policies
WHERE tablename IN (
    'checkin_preferences',
    'proactive_state',
    'user_goals',
    'user_habits',
    'checkin_events'
)
ORDER BY tablename, policyname;
