-- migrations/0019_remaining_coordinate_fixes.sql
-- Residual coordinate/network topology fixes after 0013-0018.

-- 1. Align Blue River south segment with the corrected Brush Creek/Blue Banks confluence.
UPDATE feature_geometries
SET public_geometry = '{"type": "LineString", "coordinates": [[-94.518, 39.039], [-94.520, 39.035], [-94.522, 39.031], [-94.526, 39.028], [-94.526, 39.010], [-94.527, 38.990], [-94.528, 38.970], [-94.528, 38.950], [-94.527, 38.936], [-94.527, 38.924]]}'
WHERE feature_id = 'seed_037';

-- 2. Rebuild Blue River north segment to run north from the corrected Blue Banks confluence.
UPDATE feature_geometries
SET public_geometry = '{"type": "LineString", "coordinates": [[-94.518, 39.039], [-94.519, 39.045], [-94.520, 39.055], [-94.520, 39.065], [-94.520, 39.075], [-94.520, 39.085]]}'
WHERE feature_id = 'seed_036';

-- 3. Update the neighborhood ladder to use the corrected point coordinates (Dunbar, East Blue Valley, Blue Banks).
UPDATE feature_geometries
SET public_geometry = '{"type": "LineString", "coordinates": [[-94.555, 39.110], [-94.502, 39.059], [-94.515, 39.075], [-94.5184, 39.0391], [-94.500, 39.071], [-94.486, 39.060], [-94.532, 39.048], [-94.554, 39.028], [-94.603, 39.049]]}'
WHERE feature_id = 'seed_041';

-- 4. Extend Longview-to-Grandview connector to the expanded Grandview boundary anchor.
UPDATE feature_geometries
SET public_geometry = '{"type": "LineString", "coordinates": [[-94.488, 38.869], [-94.500, 38.820], [-94.533, 38.750]]}'
WHERE feature_id = 'seed_044';

-- 5. Move Blue Banks Park marker onto the corrected confluence so the handoff point matches the trail network.
UPDATE feature_geometries
SET public_geometry = '{"type": "Point", "coordinates": [-94.518, 39.039]}'
WHERE feature_id = 'seed_010';
