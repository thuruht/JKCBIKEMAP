-- migrations/0016_notifications_system.sql

CREATE TABLE notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL, -- 'comment', 'dm', 'system', 'report_resolved'
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    link TEXT, -- Internal path like /feature/[uuid] or [slug]
    is_read BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
