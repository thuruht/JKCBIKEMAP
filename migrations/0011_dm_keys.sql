-- migrations/0011_dm_keys.sql
-- Add public_key field for E2EE Direct Messaging
ALTER TABLE users ADD COLUMN public_key TEXT;
