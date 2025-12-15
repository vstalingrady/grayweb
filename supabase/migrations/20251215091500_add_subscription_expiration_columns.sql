-- Add subscription expiration columns used by the backend.

ALTER TABLE IF EXISTS public.users
  ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMP;

ALTER TABLE IF EXISTS public.transactions
  ADD COLUMN IF NOT EXISTS subscription_starts_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS subscription_ends_at TIMESTAMP;

