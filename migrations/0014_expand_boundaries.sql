-- migrations/0014_expand_boundaries.sql

-- 1. Push boundary anchors further out to cover more of the metro
UPDATE feature_geometries SET public_geometry = '{"type": "Point", "coordinates": [-94.554, 39.300]}' WHERE feature_id = 'seed_018'; -- North (Liberty/KCI direction)
UPDATE feature_geometries SET public_geometry = '{"type": "Point", "coordinates": [-94.100, 39.017]}' WHERE feature_id = 'seed_019'; -- East (Beyond Blue Springs)
UPDATE feature_geometries SET public_geometry = '{"type": "Point", "coordinates": [-94.533, 38.750]}' WHERE feature_id = 'seed_020'; -- South (Belton/Raymore)
UPDATE feature_geometries SET public_geometry = '{"type": "Point", "coordinates": [-94.850, 38.982]}' WHERE feature_id = 'seed_021'; -- West (West Olathe)

-- 2. Hide the thick connecting lines (the 'diamond' shape itself)
UPDATE features SET visibility = 'private' WHERE id = 'seed_040';
