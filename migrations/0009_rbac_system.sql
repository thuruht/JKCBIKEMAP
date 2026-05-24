-- migrations/0009_rbac_system.sql
-- Update initial admins
INSERT OR IGNORE INTO users (id, email, role) VALUES ('admin_distorted', 'admin@map.distorted.work', 'admin');
INSERT OR IGNORE INTO users (id, email, role) VALUES ('admin_jojomap', 'admin@jojomap.kcmo.xyz', 'admin');
INSERT OR IGNORE INTO users (id, email, role) VALUES ('admin_jojo_kcmo', 'jojo@kcmo.xyz', 'admin');

-- Ensure they have admin role if they already exist
UPDATE users SET role = 'admin' WHERE email IN ('admin@map.distorted.work', 'admin@jojomap.kcmo.xyz', 'jojo@kcmo.xyz');
