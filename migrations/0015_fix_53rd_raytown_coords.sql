-- migrations/0015_fix_53rd_raytown_coords.sql

-- 1. Fix '53rd & Raytown area' point coordinates
UPDATE feature_geometries SET public_geometry = '{"type": "Point", "coordinates": [-94.4715, 39.0278]}'
WHERE feature_id = 'seed_009';

-- 2. Fix the start of '53rd to Minor Park idea' line to match the new point
-- Old: [[-94.504, 39.030], ...]
-- New: [[-94.4715, 39.0278], ...]
UPDATE feature_geometries SET public_geometry = '{"type": "LineString", "coordinates": [[-94.4715, 39.0278], [-94.511, 39.020], [-94.520, 39.010], [-94.526, 38.990], [-94.527, 38.960], [-94.527, 38.924]]}'
WHERE feature_id = 'seed_042';
