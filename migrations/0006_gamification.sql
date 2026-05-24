-- migrations/0006_gamification.sql
ALTER TABLE users ADD COLUMN reputation_score INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN contributor_level INTEGER DEFAULT 1;

CREATE TABLE badges (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    icon_svg TEXT
);

CREATE TABLE user_badges (
    user_id TEXT NOT NULL,
    badge_id TEXT NOT NULL,
    unlocked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, badge_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (badge_id) REFERENCES badges(id) ON DELETE CASCADE
);

-- Seed some initial badges
INSERT INTO badges (id, name, description) VALUES 
('bridge-hunter', 'Bridge Hunter', 'Contributed data on a pedestrian bridge.'),
('mud-finder', 'Mud Finder', 'Submitted a field report about trail conditions.'),
('trail-pioneer', 'Trail Pioneer', 'Mapped a new primary trail spine.'),
('night-rider', 'Night Rider', 'Contributed knowledge from a night-time perspective.'),
('local-legend', 'Local Legend', 'Reached Level 10 through consistent high-quality knowledge.');
