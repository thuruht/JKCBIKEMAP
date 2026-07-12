-- migrations/0020_rename_pedestrian_category.sql

-- Unify bridge category naming. Avoids the shortened "Ped" form;
-- uses plain language riders actually understand.
UPDATE features
SET category = 'Walking / mixed-use bridges'
WHERE category IN ('Ped bridges / sidewalks', 'Pedestrian or walking bridges');
