-- Add missing last_six_hour_reset column
-- Migration: 20251121000003_add_last_six_hour_reset.sql

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS last_six_hour_reset TEXT;
