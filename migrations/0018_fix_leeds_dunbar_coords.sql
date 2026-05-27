-- migrations/0018_fix_leeds_dunbar_coords.sql

-- 1. Fix 'Dunbar' (seed_008)
-- Old: [-94.538, 39.104] (Lykins/Scarritt area - WRONG)
-- New: [-94.502, 39.059] (36th & Oakley - Historic Leeds-Dunbar)
UPDATE feature_geometries SET public_geometry = '{"type": "Point", "coordinates": [-94.502, 39.059]}'
WHERE feature_id = 'seed_008';

UPDATE features SET 
    public_description = 'Historic Leeds-Dunbar community area; historic suburb near the Blue River corridor.'
WHERE id = 'seed_008';

-- 2. Fix 'Farewell / Leeds access' (seed_011)
-- Old: [-94.511, 39.091] (Sheffield area - WRONG)
-- New: [-94.505, 39.055] (Leeds Rd & Stadium Dr vicinity)
UPDATE feature_geometries SET public_geometry = '{"type": "Point", "coordinates": [-94.505, 39.055]}'
WHERE feature_id = 'seed_011';

UPDATE features SET 
    name = 'Leeds / Farewell / Howdy area',
    public_description = 'Key industrial-river corridor access near Leeds Rd and Stadium Dr; includes Farewell and Howdy areas.'
WHERE id = 'seed_011';

-- 3. Fix 'East Blue Valley' (seed_004)
-- Old: [-94.523, 39.090] (Too far north)
-- New: [-94.515, 39.075] (Industrial corridor south of Sheffield)
UPDATE feature_geometries SET public_geometry = '{"type": "Point", "coordinates": [-94.515, 39.075]}'
WHERE feature_id = 'seed_004';

UPDATE features SET 
    public_description = 'Industrial-river corridor zone south of Sheffield, providing access toward Leeds.'
WHERE id = 'seed_004';

-- 4. Fix 'Sheffield Park' description (seed_026)
-- Old: 'East-side park near the stadium and Leeds corridor.' (Confusing/Wrong)
-- New: 'Northeast industrial zone park near Independence Ave and the Blue River.'
UPDATE features SET 
    public_description = 'Northeast industrial zone park near Independence Ave and the Blue River.'
WHERE id = 'seed_026';
