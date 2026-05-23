1# Jojo's KC Bike Map — Data Model Notes

## Core principles

- Separate map data from UI code.
- Treat geometry, metadata, sources, revisions, and reports as related but distinct concerns.
- Support both public-safe and admin-only renderings for sensitive features.
- Preserve an edit history for everything important.

## Suggested tables

### `features`

Core feature identity and display metadata.

### `feature_geometries`

Stores current and historical geometries as GeoJSON-compatible JSON blobs.[cite:217][cite:223]

### `feature_revisions`

Immutable revision log with actor, timestamp, changed fields, and previous/current geometry references.

### `feature_sources`

Stores URLs, notes, source type, confidence, and verification timestamps.

### `reports`

Stores field reports such as mud, flooding, construction, closures, open gates, debris, and connector usability.

### `feature_visibility`

Stores whether a feature is public, informal, sensitive, or private.

## Sensitivity split idea

For sensitive features, consider storing:

- `public_geometry`
- `admin_geometry`
- `public_description`
- `admin_note`

This allows the same logical feature to render differently depending on viewer permissions.

## Searchable text strategy

Maintain a denormalized searchable text column or generated search text assembled from name, aliases, category, neighborhood, park, status, and notes. This keeps early search simple while remaining compatible with relational structure.[cite:226][cite:227]
