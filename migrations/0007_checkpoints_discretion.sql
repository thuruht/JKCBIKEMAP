-- migrations/0007_checkpoints_discretion.sql

-- Checkpoints table for Contributors to log their presence/verification
CREATE TABLE checkpoints (
    id TEXT PRIMARY KEY,
    contributor_id TEXT NOT NULL,
    feature_id TEXT NOT NULL,
    check_in_type TEXT DEFAULT 'passage', -- passage, verification, media_update
    note TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(contributor_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(feature_id) REFERENCES features(id) ON DELETE CASCADE
);

-- Geography-based badges
INSERT INTO badges (id, name, description) VALUES 
('river-crosser', 'River Crosser', 'Verified passage across a major walking bridge.'),
('trail-veteran', 'Trail Pioneer', 'Logged 10+ checkpoints on primary trail spines.'),
('intel-validator', 'Knowledge Validator', 'Verified the accuracy of an informal connector.'),
('media-node', 'Media Node', 'Attached high-fidelity media to a feature.');

-- Update Terminology
UPDATE features SET category = 'Pedestrian or walking bridges' WHERE category = 'Ped bridges / sidewalks';
UPDATE features SET name = REPLACE(name, 'Ped Bridge', 'Walking Bridge') WHERE name LIKE '%Ped Bridge%';
UPDATE features SET name = REPLACE(name, 'ped bridge', 'walking bridge') WHERE name LIKE '%ped bridge%';
UPDATE features SET public_description = REPLACE(public_description, 'ped bridge', 'pedestrian or walking bridge') WHERE public_description LIKE '%ped bridge%';
