-- migrations/0010_vanity_profiles.sql
-- Add vanity profile fields to the users table
ALTER TABLE users ADD COLUMN username TEXT;
ALTER TABLE users ADD COLUMN bio TEXT;
ALTER TABLE users ADD COLUMN avatar_url TEXT;
ALTER TABLE users ADD COLUMN social_links TEXT; -- Store as JSON string
