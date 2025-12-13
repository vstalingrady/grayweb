-- Migration: Add reminders column to message tables
-- Created: 2025-12-11
-- Purpose: Persist reminder/plan/habit card data with messages so they survive page reloads

-- Add reminders column to general_chat_messages table
ALTER TABLE IF EXISTS public.general_chat_messages
  ADD COLUMN IF NOT EXISTS reminders JSON DEFAULT NULL;

-- Add reminders column to user_chat_messages table  
ALTER TABLE IF EXISTS public.user_chat_messages
  ADD COLUMN IF NOT EXISTS reminders JSON DEFAULT NULL;
