-- migrations/0012_creator_recognition.sql
-- Create the Site Creator badge
INSERT OR IGNORE INTO badges (id, name, description) VALUES 
('site-creator', 'Site Creator', 'The original architect and primary visionary of JOJO''s KC Bike Map.');

-- Award XP and Badge to the creator account
UPDATE users SET reputation_score = 420 WHERE email = 'jojo@kcmo.xyz';

-- Award the badge
INSERT OR IGNORE INTO user_badges (user_id, badge_id)
SELECT id, 'site-creator' FROM users WHERE email = 'jojo@kcmo.xyz';

-- Also recognize the admin account for the domain
UPDATE users SET reputation_score = 420 WHERE email = 'admin@jojomap.kcmo.xyz';
INSERT OR IGNORE INTO user_badges (user_id, badge_id)
SELECT id, 'site-creator' FROM users WHERE email = 'admin@jojomap.kcmo.xyz';
