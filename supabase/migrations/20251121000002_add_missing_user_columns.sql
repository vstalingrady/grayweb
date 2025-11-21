-- Add missing columns to users table
-- Migration: 20251121000002_add_missing_user_columns.sql

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS has_seen_general_chat BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS daily_token_usage INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS monthly_cost_usage FLOAT DEFAULT 0.0,
ADD COLUMN IF NOT EXISTS weekly_cost_usage FLOAT DEFAULT 0.0,
ADD COLUMN IF NOT EXISTS six_hour_cost_usage FLOAT DEFAULT 0.0,
ADD COLUMN IF NOT EXISTS last_daily_reset TEXT,
ADD COLUMN IF NOT EXISTS last_monthly_reset TEXT,
ADD COLUMN IF NOT EXISTS last_weekly_reset TEXT;
