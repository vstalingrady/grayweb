-- Add personalization columns to users table
-- Migration: 20251121000001_add_personalization_to_users.sql

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS personalization_nickname TEXT,
ADD COLUMN IF NOT EXISTS personalization_occupation TEXT,
ADD COLUMN IF NOT EXISTS personalization_about TEXT,
ADD COLUMN IF NOT EXISTS personalization_custom_instructions TEXT;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_personalization_nickname ON users(personalization_nickname);
