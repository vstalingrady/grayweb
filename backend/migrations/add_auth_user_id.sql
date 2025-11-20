ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_user_id TEXT UNIQUE;
CREATE INDEX IF NOT EXISTS idx_users_auth_user_id ON users(auth_user_id);
