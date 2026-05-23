-- migrations/0008_comments_and_sources.sql

CREATE TABLE comments (
    id TEXT PRIMARY KEY,
    feature_id TEXT NOT NULL,
    user_id TEXT, -- nullable for anonymous or legacy
    author_name TEXT DEFAULT 'Anonymous Rider',
    body TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(feature_id) REFERENCES features(id) ON DELETE CASCADE,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Ensure feature_sources can easily link users if needed, though schema is okay.
-- Ensure reports has an index for fast lookup by feature_id
CREATE INDEX idx_reports_feature_id ON reports(feature_id);
CREATE INDEX idx_comments_feature_id ON comments(feature_id);
