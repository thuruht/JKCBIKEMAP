-- migrations/0003_enhanced_reports.sql
ALTER TABLE reports ADD COLUMN longevity TEXT DEFAULT 'temporary'; -- temporary, permanent
ALTER TABLE reports ADD COLUMN delete_token TEXT; -- unique token for poster to delete
ALTER TABLE reports ADD COLUMN poster_email TEXT; -- optional, for verification or notifications
