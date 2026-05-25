-- migrations/0013_usgs_data_accuracy.sql

-- 1. Fix Inaccurate Brush Creek Greenway Geometry
UPDATE feature_geometries SET public_geometry = '{"type": "LineString", "coordinates": [[-94.607, 39.038], [-94.594, 39.040], [-94.580, 39.044], [-94.565, 39.051], [-94.550, 39.060], [-94.537, 39.055], [-94.520, 39.039]]}'
WHERE feature_id = 'seed_035';

-- 2. Add Missing USGS Key Parks & Waypoints
INSERT OR IGNORE INTO features (id, slug, name, feature_type, category, status, officiality, source_confidence, public_description) VALUES
('usgs-holmes-park', 'holmes-park', 'Holmes Park', 'point', 'Key parks', 'active', 'official', 'high', 'USGS GNIS verified location.'),
('usgs-oakwood-park', 'oakwood-park', 'Oakwood Park', 'point', 'Key parks', 'active', 'official', 'high', 'USGS GNIS verified location.'),
('usgs-parkville', 'parkville-nature', 'Parkville Nature Sanctuary Area', 'point', 'Key parks', 'active', 'official', 'high', 'USGS GNIS verified location.'),
('usgs-roeland-park', 'roeland-park', 'Roeland Park', 'point', 'Key parks', 'active', 'official', 'high', 'USGS GNIS verified location.'),
('usgs-overland-park', 'overland-park-central', 'Overland Park Central', 'point', 'Key parks', 'active', 'official', 'high', 'USGS GNIS verified location.'),
('usgs-tomahawk-parkway', 'tomahawk-parkway', 'Tomahawk Parkway', 'point', 'Trail spines', 'active', 'official', 'high', 'USGS GNIS verified location.'),
('usgs-blackbob-park', 'blackbob-park', 'Blackbob Park', 'point', 'Key parks', 'active', 'official', 'high', 'USGS GNIS verified location.'),
('usgs-kill-creek-park', 'kill-creek-park', 'Kill Creek Park', 'point', 'Key parks', 'active', 'official', 'high', 'USGS GNIS verified location.'),
('usgs-shawnee-mission-park', 'shawnee-mission-park', 'Shawnee Mission Park', 'point', 'Key parks', 'active', 'official', 'high', 'USGS GNIS verified location.'),
('usgs-stoll-park', 'stoll-park', 'Stoll Park', 'point', 'Key parks', 'active', 'official', 'high', 'USGS GNIS verified location.');

-- Insert Geometries for new points
INSERT OR IGNORE INTO feature_geometries (feature_id, public_geometry) VALUES
('usgs-holmes-park', '{"type": "Point", "coordinates": [-94.5357, 38.9525]}'),
('usgs-oakwood-park', '{"type": "Point", "coordinates": [-94.5738, 39.2033]}'),
('usgs-parkville', '{"type": "Point", "coordinates": [-94.6821, 39.1950]}'),
('usgs-roeland-park', '{"type": "Point", "coordinates": [-94.6321, 39.0375]}'),
('usgs-overland-park', '{"type": "Point", "coordinates": [-94.6707, 38.9822]}'),
('usgs-tomahawk-parkway', '{"type": "Point", "coordinates": [-94.6268, 38.9198]}'),
('usgs-blackbob-park', '{"type": "Point", "coordinates": [-94.7522, 38.8556]}'),
('usgs-kill-creek-park', '{"type": "Point", "coordinates": [-94.9745, 38.9126]}'),
('usgs-shawnee-mission-park', '{"type": "Point", "coordinates": [-94.7891, 38.9957]}'),
('usgs-stoll-park', '{"type": "Point", "coordinates": [-94.7290, 38.9169]}');
