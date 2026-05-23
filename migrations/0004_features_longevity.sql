-- migrations/0004_features_longevity.sql
ALTER TABLE features ADD COLUMN longevity TEXT DEFAULT 'permanent'; -- temporary, permanent
ALTER TABLE features ADD COLUMN poster_email TEXT;
ALTER TABLE features ADD COLUMN delete_token TEXT;
