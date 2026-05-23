-- migrations/0001_initial.sql
DROP TABLE IF EXISTS reports;
DROP TABLE IF EXISTS feature_sources;
DROP TABLE IF EXISTS feature_revisions;
DROP TABLE IF EXISTS feature_geometries;
DROP TABLE IF EXISTS features;

CREATE TABLE features (
    id TEXT PRIMARY KEY,
    slug TEXT UNIQUE,
    name TEXT NOT NULL,
    feature_type TEXT NOT NULL, -- point, line, polygon, zone, corridor
    category TEXT NOT NULL,
    status TEXT NOT NULL,
    visibility TEXT NOT NULL DEFAULT 'public', -- public, informal, sensitive, private
    officiality TEXT NOT NULL DEFAULT 'official', -- official, informal, unofficial, planned
    public_description TEXT,
    admin_note TEXT,
    surface_note TEXT,
    risk_note TEXT,
    weather_sensitivity TEXT,
    source_confidence TEXT,
    searchable_text TEXT,
    last_verified_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE feature_geometries (
    feature_id TEXT NOT NULL,
    public_geometry TEXT, -- GeoJSON Feature or Geometry
    admin_geometry TEXT,  -- GeoJSON Feature or Geometry (sensitive)
    FOREIGN KEY(feature_id) REFERENCES features(id) ON DELETE CASCADE
);
CREATE INDEX idx_feature_geometries_feature_id ON feature_geometries(feature_id);

CREATE TABLE feature_revisions (
    id TEXT PRIMARY KEY,
    feature_id TEXT NOT NULL,
    actor TEXT NOT NULL,
    changed_fields TEXT, -- JSON array of field names
    previous_state TEXT, -- JSON snapshot
    new_state TEXT,      -- JSON snapshot
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(feature_id) REFERENCES features(id) ON DELETE CASCADE
);

CREATE TABLE feature_sources (
    id TEXT PRIMARY KEY,
    feature_id TEXT NOT NULL,
    source_url TEXT,
    source_note TEXT,
    confidence TEXT,
    verified_at DATETIME,
    FOREIGN KEY(feature_id) REFERENCES features(id) ON DELETE CASCADE
);

CREATE TABLE reports (
    id TEXT PRIMARY KEY,
    feature_id TEXT NOT NULL,
    report_type TEXT NOT NULL, -- mud, flooding, construction, etc.
    description TEXT,
    status TEXT DEFAULT 'open',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(feature_id) REFERENCES features(id) ON DELETE CASCADE
);
